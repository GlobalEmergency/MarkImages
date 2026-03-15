/**
 * Export Final DEA Images — Proteccion Civil
 *
 * Exports processed images (square with arrow) for AEDs assigned to
 * Civil Protection organizations. Same folder structure as original export.
 * All images are passed through face-blur detection via Docker API.
 *
 * Output structure:
 *   data/exports/dea-images-final/{CODE}/
 *     {CODE}F1.jpg   — FRONT processed (with arrow + face-blur)
 *     {CODE}F2.jpg   — LOCATION processed (with arrow + face-blur)
 *
 * Usage:
 *   npx tsx scripts/export-final-dea-images.ts
 *   npx tsx scripts/export-final-dea-images.ts --no-face-blur
 *   npx tsx scripts/export-final-dea-images.ts --batch-size 100
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import sharpLib from "sharp";

// Load env (before importing Prisma so DATABASE_URL is available)
dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/client/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AedRow {
  id: string;
  code: string | null;
  provisional_number: number | null;
  name: string;
  status: string;
  location: {
    district_name: string | null;
    street_type: string | null;
    street_name: string | null;
    street_number: string | null;
  };
  images: Array<{
    id: string;
    type: string;
    order: number;
    original_url: string;
    processed_url: string | null;
    is_verified: boolean;
  }>;
  assignments: Array<{
    organization: {
      id: string;
      name: string;
      type: string;
    };
    assignment_type: string;
    status: string;
  }>;
}

interface FaceDetectionData {
  facesDetected: number;
  faceDetails: Array<{ confidence: number; bbox: number[]; area: number }>;
  processingTimeMs: number;
  markedImagePath?: string;
}

interface ExportedDea {
  aedId: string;
  code: string;
  provisionalNumber: number | null;
  name: string;
  status: string;
  distrito: string;
  direccion: string;
  hasF1: boolean;
  hasF2: boolean;
  faceDetection?: {
    imagen1?: FaceDetectionData;
    imagen2?: FaceDetectionData;
    totalFaces: number;
    maxConfidence?: number;
  };
  errors: string[];
}

interface ExportStats {
  totalAeds: number;
  exportedSuccessfully: number;
  withErrors: number;
  withImage1Only: number;
  withImage2Only: number;
  withBothImages: number;
  withoutCode: number;
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const noFaceBlur = args.includes("--no-face-blur");
const batchSize = (() => {
  const idx = args.indexOf("--batch-size");
  const val = idx !== -1 && args[idx + 1] ? parseInt(args[idx + 1], 10) : 50;
  return isNaN(val) || val < 1 ? 50 : val;
})();

// ---------------------------------------------------------------------------
// Exporter
// ---------------------------------------------------------------------------

class FinalDeaImageExporter {
  private exportDir: string;
  private stats: ExportStats;
  private exportedDeas: ExportedDea[] = [];
  private errors: Array<{ aedId: string; error: string }> = [];
  private faceBlurApiUrl = "http://localhost:5000";
  private faceBlurEnabled = !noFaceBlur;
  private startTime = Date.now();
  private processedCount = 0;
  private totalCount = 0;

  constructor() {
    this.exportDir = path.join(process.cwd(), "data", "exports", "dea-images-final");
    this.stats = {
      totalAeds: 0,
      exportedSuccessfully: 0,
      withErrors: 0,
      withImage1Only: 0,
      withImage2Only: 0,
      withBothImages: 0,
      withoutCode: 0,
    };
  }

  // -----------------------------------------------------------------------
  // Face blur API
  // -----------------------------------------------------------------------

  private async callFaceDetectionAPI(
    base64Image: string,
    code: string,
    imageId: string
  ): Promise<{ pixelatedImage: string; detectionData: FaceDetectionData | null }> {
    try {
      const response = await fetch(`${this.faceBlurApiUrl}/detect-and-mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Image,
          min_confidence: 0.8,
          padding: 0.2,
          pixel_size: 5,
          return_marked_image: true,
        }),
      });

      if (!response.ok) throw new Error(`API status ${response.status}`);

      const data = (await response.json()) as {
        faces_detected: number;
        face_details: FaceDetectionData["faceDetails"];
        processing_time_ms: number;
        marked_image?: string;
        pixelated_image: string;
      };

      let markedImagePath: string | undefined;
      if (data.faces_detected > 0 && data.marked_image) {
        const detectionsDir = path.join(this.exportDir, "face-detections", "with-faces");
        fs.mkdirSync(detectionsDir, { recursive: true });
        const markedFilepath = path.join(detectionsDir, `${code}${imageId}_marked.jpg`);
        const markedBuffer = Buffer.from(data.marked_image, "base64");
        await sharpLib(markedBuffer).jpeg({ quality: 90 }).toFile(markedFilepath);
        markedImagePath = path.relative(this.exportDir, markedFilepath);
      }

      return {
        pixelatedImage: data.pixelated_image,
        detectionData: {
          facesDetected: data.faces_detected,
          faceDetails: data.face_details || [],
          processingTimeMs: data.processing_time_ms,
          markedImagePath,
        },
      };
    } catch {
      const base64Content = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;
      return { pixelatedImage: base64Content, detectionData: null };
    }
  }

  // -----------------------------------------------------------------------
  // Image download & save
  // -----------------------------------------------------------------------

  private async downloadImage(url: string): Promise<Buffer> {
    if (url.startsWith("data:image/")) {
      const base64Data = url.split(",")[1];
      if (!base64Data) throw new Error("Invalid base64 data URI");
      return Buffer.from(base64Data, "base64");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Download timeout after 30s");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async saveImageWithFaceBlur(
    imageUrl: string,
    outputPath: string,
    code: string,
    imageId: string
  ): Promise<FaceDetectionData | null> {
    const buffer = await this.downloadImage(imageUrl);
    let detectionData: FaceDetectionData | null = null;

    if (this.faceBlurEnabled) {
      const base64 = buffer.toString("base64");
      const result = await this.callFaceDetectionAPI(base64, code, imageId);
      detectionData = result.detectionData;

      if (detectionData && detectionData.facesDetected > 0) {
        const pixelatedBuffer = Buffer.from(result.pixelatedImage, "base64");
        await sharpLib(pixelatedBuffer).jpeg({ quality: 85 }).toFile(outputPath);
        return detectionData;
      }
    }

    await sharpLib(buffer).jpeg({ quality: 85 }).toFile(outputPath);
    return detectionData;
  }

  // -----------------------------------------------------------------------
  // Export per AED
  // -----------------------------------------------------------------------

  private async exportAedImages(aed: AedRow, code: string): Promise<ExportedDea> {
    const loc = aed.location;

    const exportData: ExportedDea = {
      aedId: aed.id,
      code,
      provisionalNumber: aed.provisional_number,
      name: aed.name,
      status: aed.status,
      distrito: loc.district_name || "",
      direccion:
        `${loc.street_type || ""} ${loc.street_name || ""} ${loc.street_number || ""}`.trim(),
      hasF1: false,
      hasF2: false,
      errors: [],
    };

    const deaFolder = path.join(this.exportDir, code);
    fs.mkdirSync(deaFolder, { recursive: true });

    const frontImage = aed.images.find((i) => i.type === "FRONT");
    const locationImage = aed.images.find((i) => i.type === "LOCATION");

    let detectionImg1: FaceDetectionData | null = null;
    let detectionImg2: FaceDetectionData | null = null;

    // FRONT — processed only
    if (frontImage) {
      const url = frontImage.processed_url || frontImage.original_url;
      if (url) {
        try {
          detectionImg1 = await this.saveImageWithFaceBlur(
            url,
            path.join(deaFolder, `${code}F1.jpg`),
            code,
            "F1"
          );
          exportData.hasF1 = true;
        } catch (err) {
          exportData.errors.push(`FRONT: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    // LOCATION — processed only
    if (locationImage) {
      const url = locationImage.processed_url || locationImage.original_url;
      if (url) {
        try {
          detectionImg2 = await this.saveImageWithFaceBlur(
            url,
            path.join(deaFolder, `${code}F2.jpg`),
            code,
            "F2"
          );
          exportData.hasF2 = true;
        } catch (err) {
          exportData.errors.push(`LOCATION: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    // Face detection metadata
    const totalFaces = (detectionImg1?.facesDetected || 0) + (detectionImg2?.facesDetected || 0);
    if (totalFaces > 0) {
      const allConf = [
        ...(detectionImg1?.faceDetails.map((f) => f.confidence) || []),
        ...(detectionImg2?.faceDetails.map((f) => f.confidence) || []),
      ];
      exportData.faceDetection = {
        imagen1: detectionImg1 || undefined,
        imagen2: detectionImg2 || undefined,
        totalFaces,
        maxConfidence: allConf.length > 0 ? Math.max(...allConf) : undefined,
      };
    }

    return exportData;
  }

  // -----------------------------------------------------------------------
  // Progress & reporting
  // -----------------------------------------------------------------------

  private formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return "---";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  private displayProgress(batchIndex: number, totalBatches: number): void {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const pct = this.totalCount > 0 ? (this.processedCount / this.totalCount) * 100 : 0;
    const speed = elapsed > 0 ? this.processedCount / elapsed : 0;
    const remaining = speed > 0 ? (this.totalCount - this.processedCount) / speed : 0;

    const barLen = 30;
    const filled = Math.round((pct / 100) * barLen);
    const bar = "\u2588".repeat(filled) + "\u2591".repeat(barLen - filled);

    console.log(`\n${"=".repeat(70)}`);
    console.log(`Lote ${batchIndex + 1}/${totalBatches} [${bar}] ${pct.toFixed(1)}%`);
    console.log(`  Procesados: ${this.processedCount}/${this.totalCount}`);
    console.log(
      `  Exitosos: ${this.stats.exportedSuccessfully} | Errores: ${this.stats.withErrors}`
    );
    console.log(
      `  Tiempo: ${this.formatTime(elapsed)} | Restante: ${this.formatTime(remaining)} | ${speed.toFixed(1)} AED/s`
    );
    console.log(`${"=".repeat(70)}\n`);
  }

  private generateCSVReport(): void {
    const headers = [
      "Codigo",
      "AED ID",
      "Nombre",
      "Status",
      "Distrito",
      "Direccion",
      "FRONT",
      "LOCATION",
      "Caras Total",
      "Confianza Max",
      "Errores",
    ];

    const rows = this.exportedDeas.map((d) => {
      const totalFaces = d.faceDetection?.totalFaces || 0;
      const conf = d.faceDetection?.maxConfidence?.toFixed(2) || "";
      return [
        d.code,
        d.aedId,
        d.name.replace(/"/g, '""'),
        d.status,
        d.distrito,
        d.direccion.replace(/"/g, '""'),
        d.hasF1 ? "Si" : "No",
        d.hasF2 ? "Si" : "No",
        totalFaces.toString(),
        conf,
        d.errors.join("; ").replace(/"/g, '""'),
      ]
        .map((v) => (v.includes(";") || v.includes('"') ? `"${v}"` : v))
        .join(";");
    });

    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const csvPath = path.join(this.exportDir, `export-dea-images-${ts}.csv`);
    const BOM = "\uFEFF";
    fs.writeFileSync(csvPath, BOM + [headers.join(";"), ...rows].join("\n"), "utf8");
    console.log(`CSV: ${csvPath}`);
  }

  private generateJSONReport(): void {
    const totalTime = (Date.now() - this.startTime) / 1000;
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const jsonPath = path.join(this.exportDir, `export-metadata-${ts}.json`);

    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          metadata: {
            exportDate: new Date().toISOString(),
            exportDirectory: this.exportDir,
            filter: "CIVIL_PROTECTION assignments only",
            statistics: {
              ...this.stats,
            },
            performance: {
              totalTimeSeconds: totalTime,
              totalTimeFormatted: this.formatTime(totalTime),
              averageSpeedPerSecond:
                totalTime > 0 ? (this.processedCount / totalTime).toFixed(2) : "0",
            },
          },
          deas: this.exportedDeas,
          errors: this.errors,
        },
        null,
        2
      ),
      "utf8"
    );
    console.log(`JSON: ${jsonPath}`);
  }

  // -----------------------------------------------------------------------
  // Main
  // -----------------------------------------------------------------------

  async export(): Promise<void> {
    console.log("Exportacion de imagenes — Solo Proteccion Civil\n");

    try {
      fs.mkdirSync(this.exportDir, { recursive: true });

      // Check face-blur API
      if (this.faceBlurEnabled) {
        console.log("Verificando servicio de face blur...");
        try {
          const resp = await fetch(`${this.faceBlurApiUrl}/health`);
          if (resp.ok) {
            const health = (await resp.json()) as { model: string; using_gpu: boolean };
            console.log(`  Face blur activo (GPU: ${health.using_gpu ? "si" : "no"})\n`);
          } else {
            throw new Error("not ok");
          }
        } catch {
          console.warn("  Face blur no disponible — imagenes sin procesar\n");
          this.faceBlurEnabled = false;
        }
      } else {
        console.log("Face blur deshabilitado (--no-face-blur)\n");
      }

      // List Civil Protection organizations
      const cpOrgs = await prisma.organization.findMany({
        where: { type: "CIVIL_PROTECTION", is_active: true },
        select: { id: true, name: true },
      });

      if (cpOrgs.length === 0) {
        console.log("No hay organizaciones de Proteccion Civil activas.");
        return;
      }

      console.log(`Organizaciones de Proteccion Civil: ${cpOrgs.length}`);
      for (const org of cpOrgs) {
        console.log(`  - ${org.name}`);
      }
      console.log();

      // Where: AEDs with active CIVIL_PROTECTION assignment and images
      const where = {
        images: { some: {} },
        assignments: {
          some: {
            assignment_type: "CIVIL_PROTECTION" as const,
            status: "ACTIVE" as const,
            organization: { type: "CIVIL_PROTECTION" as const, is_active: true },
          },
        },
      };

      this.totalCount = await prisma.aed.count({ where });
      this.stats.totalAeds = this.totalCount;
      console.log(`Total AEDs asignados a Proteccion Civil con imagenes: ${this.totalCount}\n`);

      if (this.totalCount === 0) {
        console.log("No hay AEDs para exportar.");
        return;
      }

      // Process in batches using cursor pagination
      let cursor: string | undefined;
      let batchIndex = 0;
      const totalBatches = Math.ceil(this.totalCount / batchSize);

      while (this.processedCount < this.totalCount) {
        this.displayProgress(batchIndex, totalBatches);

        const aeds = await prisma.aed.findMany({
          where,
          select: {
            id: true,
            code: true,
            provisional_number: true,
            name: true,
            status: true,
            location: {
              select: {
                district_name: true,
                street_type: true,
                street_name: true,
                street_number: true,
              },
            },
            images: {
              select: {
                id: true,
                type: true,
                order: true,
                original_url: true,
                processed_url: true,
                is_verified: true,
              },
              orderBy: { order: "asc" },
            },
            assignments: {
              where: {
                assignment_type: "CIVIL_PROTECTION",
                status: "ACTIVE",
              },
              select: {
                organization: {
                  select: { id: true, name: true, type: true },
                },
                assignment_type: true,
                status: true,
              },
            },
          },
          take: batchSize,
          orderBy: { id: "asc" },
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });

        if (aeds.length === 0) break;
        cursor = aeds[aeds.length - 1].id;

        for (const aed of aeds) {
          const code = aed.code;
          if (!code) {
            this.processedCount++;
            this.stats.withoutCode++;
            continue;
          }

          const hasFront = aed.images.some((i) => i.type === "FRONT");
          const hasLocation = aed.images.some((i) => i.type === "LOCATION");

          if (!hasFront && !hasLocation) {
            this.processedCount++;
            continue;
          }

          try {
            const exported = await this.exportAedImages(aed as AedRow, code);
            this.exportedDeas.push(exported);

            if (exported.errors.length > 0) {
              this.stats.withErrors++;
            } else {
              this.stats.exportedSuccessfully++;
            }

            if (hasFront && hasLocation) this.stats.withBothImages++;
            else if (hasFront) this.stats.withImage1Only++;
            else this.stats.withImage2Only++;
          } catch (error) {
            this.stats.withErrors++;
            this.errors.push({
              aedId: aed.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }

          this.processedCount++;
          if (this.processedCount % 10 === 0) {
            process.stdout.write(`\r  [${this.processedCount}/${this.totalCount}] ${code}`);
          }
        }

        batchIndex++;
      }

      console.log("\n\nGenerando reportes...");
      this.generateCSVReport();
      this.generateJSONReport();

      // Final stats
      const totalTime = (Date.now() - this.startTime) / 1000;
      console.log(`\n${"=".repeat(70)}`);
      console.log("ESTADISTICAS FINALES");
      console.log(`${"=".repeat(70)}`);
      console.log(`Total AEDs:      ${this.stats.totalAeds}`);
      console.log(`Exportados:      ${this.stats.exportedSuccessfully}`);
      console.log(`Con errores:     ${this.stats.withErrors}`);
      console.log(`Sin codigo:      ${this.stats.withoutCode}`);
      console.log(`Solo FRONT:      ${this.stats.withImage1Only}`);
      console.log(`Solo LOCATION:   ${this.stats.withImage2Only}`);
      console.log(`Ambas:           ${this.stats.withBothImages}`);
      console.log(`\nTiempo total:    ${this.formatTime(totalTime)}`);
      console.log(`${"=".repeat(70)}`);
      console.log(`\nDirectorio: ${this.exportDir}\n`);
    } catch (error) {
      console.error("Error critico:", error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }
}

const exporter = new FinalDeaImageExporter();
exporter.export().catch(console.error);
