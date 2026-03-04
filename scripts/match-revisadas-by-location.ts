/**
 * Match DEAs from "DEA ubicaciones revisadas identificadorok.csv"
 *
 * This script matches AEDs using revised data (fin* fields) and additional information
 * like descripcionAcceso and comentarioLibre for disambiguation.
 *
 * Matching strategy (4 steps):
 * 1. Primary: Name matching (propuestaDenominacion)
 * 2. Secondary: Coordinates proximity (finLAT, finLON) if multiple name matches
 * 3. Tertiary: Address matching (finTIPO, finVIA, finNUM) if still ambiguous
 * 4. Quaternary: Description matching (descripcionAcceso, comentarioLibre) for final disambiguation
 *
 * Run with:
 *   npx tsx scripts/match-revisadas-by-location.ts                    # DRY-RUN
 *   npx tsx scripts/match-revisadas-by-location.ts --execute          # EXECUTE
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/client/client";
import { parse } from "csv-parse/sync";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();
//Load .env.local
dotenv.config({ path: ".env.local", override: true });

const connectionString = process.env.DATABASE_URL || "";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ============================================
// TYPES
// ============================================

interface CsvRow {
  row_number: number;
  Id: string;
  numeroProvisionalDea: string;
  propuestaDenominacion: string;
  descripcionAcceso: string;
  comentarioLibre: string;
  defCodDea: string;
  finTIPO: string;
  finVIA: string;
  finNUM: string;
  finLAT: string;
  finLON: string;
}

interface ProcessResult {
  csv_row: number;
  Id: string;
  defCodDea: string;
  numeroProvisionalDea: string;
  csv_name: string;
  csv_address: string;
  csv_coords: string;
  csv_descripcion: string;
  csv_comentario: string;
  db_id: string | null;
  db_name: string | null;
  db_address: string | null;
  db_coords: string | null;
  db_access_info: string | null;
  status: "OK" | "WARNING" | "ERROR";
  action:
    | "MATCHED_NAME"
    | "MATCHED_NAME_COORDS"
    | "MATCHED_NAME_ADDRESS"
    | "MATCHED_NAME_DESCRIPTION"
    | "MULTIPLE_MATCHES"
    | "NOT_FOUND"
    | "CODE_CONFLICT"
    | "SKIPPED";
  message: string;
  matches_found?: number;
  distance_meters?: number;
}

interface Statistics {
  total: number;
  skipped: number;
  matched_name: number;
  matched_name_coords: number;
  matched_name_address: number;
  matched_name_description: number;
  multiple_matches: number;
  not_found: number;
  code_conflicts: number;
}

// ============================================
// CONFIGURATION
// ============================================

const CSV_INPUT_PATH = path.join(
  process.cwd(),
  "data",
  "CSV",
  "DEA ubicaciones revisadas identificadorok.csv"
);
const LOGS_DIR = path.join(process.cwd(), "logs");
const DRY_RUN = !process.argv.includes("--execute");
const MAX_DISTANCE_METERS = 100; // Maximum distance to consider a coordinate match

// ============================================
// UTILITIES
// ============================================

function parseCSV(content: string): CsvRow[] {
  try {
    // Usar csv-parse para manejar correctamente campos con ;, comillas, etc.
    const records = parse(content, {
      columns: false, // No usar primera fila como headers
      skip_empty_lines: true,
      delimiter: ";", // Usar ; como separador
      quote: '"', // Respetar comillas
      escape: '"', // Escapar comillas dobles
      relax_quotes: true, // Tolerante con comillas
      trim: true, // Trim automático
      from_line: 2, // Saltar header (empezar desde línea 2)
      relax_column_count: true, // Tolerar columnas inconsistentes
    }) as string[][];

    const rows: CsvRow[] = [];
    for (let i = 0; i < records.length; i++) {
      const parts = records[i];
      if (parts.length >= 33) {
        rows.push({
          row_number: i + 2, // +2 porque saltamos header y empezamos en línea 2
          Id: parts[0] || "",
          numeroProvisionalDea: parts[1] || "",
          propuestaDenominacion: parts[6] || "",
          descripcionAcceso: parts[25] || "",
          comentarioLibre: parts[26] || "",
          defCodDea: parts[27] || "",
          finTIPO: parts[28] || "",
          finVIA: parts[29] || "",
          finNUM: parts[30] || "",
          finLAT: parts[31] || "",
          finLON: parts[32] || "",
        });
      }
    }

    return rows;
  } catch (error) {
    console.error("❌ Error parseando CSV:", error);
    throw new Error(`Error al parsear CSV: ${error instanceof Error ? error.message : "Unknown"}`);
  }
}

function normalizeText(text: string): string {
  // Normalización simple: solo lowercase y espacios
  // Respeta acentos y caracteres especiales (UTF-8)
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function formatAddress(tipo: string, via: string, num: string): string {
  const parts = [tipo, via, num].filter((p) => p);
  return parts.join(" ");
}

// REMOVED: compareDescriptions - now using pg_trgm similarity in database

function ensureLogsDir(): void {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function generateCSVOutput(results: ProcessResult[]): Buffer {
  const header =
    "csv_row;Id;defCodDea;numeroProvisionalDea;csv_name;csv_address;csv_coords;csv_descripcion;csv_comentario;" +
    "db_id;db_name;db_address;db_coords;db_access_info;status;action;message;matches_found;distance_meters\n";

  const rows = results
    .map((r) => {
      // Encapsular campos entre comillas y escapar comillas dobles existentes
      const escape = (s: string) => `"${s.replace(/"/g, '""').replace(/\n/g, " ")}"`;
      return (
        `${r.csv_row};${escape(r.Id)};${escape(r.defCodDea)};${escape(r.numeroProvisionalDea)};${escape(r.csv_name)};` +
        `${escape(r.csv_address)};${escape(r.csv_coords)};${escape(r.csv_descripcion)};${escape(r.csv_comentario)};` +
        `${escape(r.db_id || "")};${escape(r.db_name || "")};${escape(r.db_address || "")};${escape(r.db_coords || "")};` +
        `${escape(r.db_access_info || "")};${escape(r.status)};${escape(r.action)};${escape(r.message)};` +
        `${escape(r.matches_found?.toString() || "")};${escape(r.distance_meters?.toString() || "")}`
      );
    })
    .join("\n");

  const BOM = "\uFEFF";
  return Buffer.from(BOM + header + rows, "utf8");
}

function getOutputFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const suffix = DRY_RUN ? "dryrun" : "executed";
  return `revisadas-match-location-${timestamp}-${suffix}.csv`;
}

// ============================================
// CORE LOGIC
// ============================================

async function processRow(row: CsvRow): Promise<ProcessResult> {
  const {
    row_number,
    Id,
    numeroProvisionalDea,
    propuestaDenominacion,
    descripcionAcceso,
    comentarioLibre,
    defCodDea,
    finTIPO,
    finVIA,
    finNUM,
    finLAT,
    finLON,
  } = row;

  const csvAddress = formatAddress(finTIPO, finVIA, finNUM);
  const csvCoords = `${finLAT},${finLON}`;

  // SKIP: Si el code ya existe en la BBDD, no procesar
  if (defCodDea) {
    const existingAed = await prisma.aed.findUnique({
      where: { code: defCodDea },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        location: {
          select: {
            street_type: true,
            street_name: true,
            street_number: true,
            access_instructions: true,
          },
        },
      },
    });

    if (existingAed) {
      return {
        csv_row: row_number,
        Id,
        defCodDea,
        numeroProvisionalDea,
        csv_name: propuestaDenominacion,
        csv_address: csvAddress,
        csv_coords: csvCoords,
        csv_descripcion: descripcionAcceso,
        csv_comentario: comentarioLibre,
        db_id: existingAed.id,
        db_name: existingAed.name,
        db_address: formatAddress(
          existingAed.location?.street_type || "",
          existingAed.location?.street_name || "",
          existingAed.location?.street_number || ""
        ),
        db_coords:
          existingAed.latitude && existingAed.longitude
            ? `${existingAed.latitude},${existingAed.longitude}`
            : "",
        db_access_info: existingAed.location?.access_instructions || "",
        status: "OK",
        action: "SKIPPED",
        message: `Ya procesado anteriormente (code: ${defCodDea})`,
        matches_found: 1,
      };
    }
  }

  // Validate input
  if (!propuestaDenominacion) {
    return {
      csv_row: row_number,
      Id,
      defCodDea,
      numeroProvisionalDea,
      csv_name: "",
      csv_address: csvAddress,
      csv_coords: csvCoords,
      csv_descripcion: descripcionAcceso,
      csv_comentario: comentarioLibre,
      db_id: null,
      db_name: null,
      db_address: null,
      db_coords: null,
      db_access_info: null,
      status: "ERROR",
      action: "NOT_FOUND",
      message: "Nombre vacío en el CSV",
    };
  }

  // STEP 1: Match by name (case-insensitive using Prisma)
  // Solo buscar AEDs sin code asignado (disponibles para matching)
  const nameMatches = await prisma.aed.findMany({
    where: {
      name: {
        equals: propuestaDenominacion.trim(),
        mode: "insensitive",
      },
      code: null, // Solo AEDs sin code asignado
    },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      location: {
        select: {
          street_type: true,
          street_name: true,
          street_number: true,
          access_instructions: true,
          access_description: true,
          public_notes: true,
        },
      },
    },
  });

  // No matches found
  if (nameMatches.length === 0) {
    return {
      csv_row: row_number,
      Id,
      defCodDea,
      numeroProvisionalDea,
      csv_name: propuestaDenominacion,
      csv_address: csvAddress,
      csv_coords: csvCoords,
      csv_descripcion: descripcionAcceso,
      csv_comentario: comentarioLibre,
      db_id: null,
      db_name: null,
      db_address: null,
      db_coords: null,
      db_access_info: null,
      status: "ERROR",
      action: "NOT_FOUND",
      message: "No se encontró ningún DEA con ese nombre",
      matches_found: 0,
    };
  }

  // Single name match - PERFECT!
  if (nameMatches.length === 1) {
    const match = nameMatches[0];

    if (!DRY_RUN) {
      const updateResult = await updateAed(match.id, defCodDea, Id, numeroProvisionalDea);
      if (!updateResult.success) {
        return {
          csv_row: row_number,
          Id,
          defCodDea,
          numeroProvisionalDea,
          csv_name: propuestaDenominacion,
          csv_address: csvAddress,
          csv_coords: csvCoords,
          csv_descripcion: descripcionAcceso,
          csv_comentario: comentarioLibre,
          db_id: match.id,
          db_name: match.name,
          db_address: formatAddress(
            match.location?.street_type || "",
            match.location?.street_name || "",
            match.location?.street_number || ""
          ),
          db_coords:
            match.latitude && match.longitude ? `${match.latitude},${match.longitude}` : "",
          db_access_info: match.location?.access_instructions || "",
          status: "WARNING",
          action: "CODE_CONFLICT",
          message: `Código ${defCodDea} ya asignado a otro DEA (${updateResult.conflictingAedId})`,
          matches_found: 1,
        };
      }
    }

    return {
      csv_row: row_number,
      Id,
      defCodDea,
      numeroProvisionalDea,
      csv_name: propuestaDenominacion,
      csv_address: csvAddress,
      csv_coords: csvCoords,
      csv_descripcion: descripcionAcceso,
      csv_comentario: comentarioLibre,
      db_id: match.id,
      db_name: match.name,
      db_address: formatAddress(
        match.location?.street_type || "",
        match.location?.street_name || "",
        match.location?.street_number || ""
      ),
      db_coords: match.latitude && match.longitude ? `${match.latitude},${match.longitude}` : "",
      db_access_info: match.location?.access_instructions || "",
      status: "OK",
      action: "MATCHED_NAME",
      message: "Match único por nombre",
      matches_found: 1,
    };
  }

  // STEP 2: Multiple name matches - use coordinates
  const csvLat = parseFloat(finLAT);
  const csvLon = parseFloat(finLON);

  if (!isNaN(csvLat) && !isNaN(csvLon)) {
    const coordMatches = nameMatches
      .map((aed) => {
        if (!aed.latitude || !aed.longitude) return null;
        const distance = calculateDistance(csvLat, csvLon, aed.latitude, aed.longitude);
        return { aed, distance };
      })
      .filter(
        (m): m is { aed: (typeof nameMatches)[0]; distance: number } =>
          m !== null && m.distance <= MAX_DISTANCE_METERS
      )
      .sort((a, b) => a.distance - b.distance);

    if (coordMatches.length === 1) {
      const match = coordMatches[0];

      if (!DRY_RUN) {
        await updateAed(match.aed.id, defCodDea, Id, numeroProvisionalDea);
      }

      return {
        csv_row: row_number,
        Id,
        defCodDea,
        numeroProvisionalDea,
        csv_name: propuestaDenominacion,
        csv_address: csvAddress,
        csv_coords: csvCoords,
        csv_descripcion: descripcionAcceso,
        csv_comentario: comentarioLibre,
        db_id: match.aed.id,
        db_name: match.aed.name,
        db_address: formatAddress(
          match.aed.location?.street_type || "",
          match.aed.location?.street_name || "",
          match.aed.location?.street_number || ""
        ),
        db_coords: `${match.aed.latitude},${match.aed.longitude}`,
        db_access_info: match.aed.location?.access_instructions || "",
        status: "OK",
        action: "MATCHED_NAME_COORDS",
        message: `Match por nombre + coordenadas (${Math.round(match.distance)}m)`,
        matches_found: 1,
        distance_meters: Math.round(match.distance),
      };
    }

    // Use coord matches for next steps if we have any, otherwise use all name matches
    const nextStepMatches = coordMatches.length > 0 ? coordMatches.map((m) => m.aed) : nameMatches;

    // STEP 3: Try address matching
    const normalizedCsvAddress = normalizeText(csvAddress);
    if (normalizedCsvAddress) {
      const addressMatches = nextStepMatches.filter((aed) => {
        const aedAddress = formatAddress(
          aed.location?.street_type || "",
          aed.location?.street_name || "",
          aed.location?.street_number || ""
        );
        const normalizedAedAddress = normalizeText(aedAddress);
        return (
          normalizedAedAddress.includes(normalizedCsvAddress) ||
          normalizedCsvAddress.includes(normalizedAedAddress)
        );
      });

      if (addressMatches.length === 1) {
        const match = addressMatches[0];

        if (!DRY_RUN) {
          await updateAed(match.id, defCodDea, Id, numeroProvisionalDea);
        }

        return {
          csv_row: row_number,
          Id,
          defCodDea,
          numeroProvisionalDea,
          csv_name: propuestaDenominacion,
          csv_address: csvAddress,
          csv_coords: csvCoords,
          csv_descripcion: descripcionAcceso,
          csv_comentario: comentarioLibre,
          db_id: match.id,
          db_name: match.name,
          db_address: formatAddress(
            match.location?.street_type || "",
            match.location?.street_name || "",
            match.location?.street_number || ""
          ),
          db_coords:
            match.latitude && match.longitude ? `${match.latitude},${match.longitude}` : "",
          db_access_info: match.location?.access_instructions || "",
          status: "OK",
          action: "MATCHED_NAME_ADDRESS",
          message: "Match por nombre + dirección",
          matches_found: 1,
        };
      }

      // STEP 4: Try description matching using pg_trgm similarity
      if (descripcionAcceso || comentarioLibre) {
        const candidateMatches = addressMatches.length > 0 ? addressMatches : nextStepMatches;
        const candidateIds = candidateMatches.map((aed) => aed.id);

        // Skip if no candidates or no description text
        const csvDescription = `${descripcionAcceso} ${comentarioLibre}`.trim();
        if (candidateIds.length > 0 && csvDescription.length >= 15) {
          // Use pg_trgm similarity to find the best match
          const similarityResults = await prisma.$queryRaw<
            Array<{
              id: string;
              name: string;
              similarity_score: number;
              access_instructions: string | null;
              access_description: string | null;
              street_type: string | null;
              street_name: string | null;
              street_number: string | null;
              latitude: number | null;
              longitude: number | null;
            }>
          >`
            SELECT 
              a.id,
              a.name,
              a.latitude,
              a.longitude,
              l.street_type,
              l.street_name,
              l.street_number,
              l.access_instructions,
              l.access_description,
              similarity(
                CONCAT(
                  COALESCE(l.access_instructions, ''), ' ',
                  COALESCE(l.access_description, ''), ' ',
                  COALESCE(l.public_notes, '')
                ),
                ${csvDescription}
              ) as similarity_score
            FROM aeds a
            LEFT JOIN aed_locations l ON a.location_id = l.id
            WHERE a.id = ANY(${candidateIds}::uuid[])
              AND similarity(
                CONCAT(
                  COALESCE(l.access_instructions, ''), ' ',
                  COALESCE(l.access_description, ''), ' ',
                  COALESCE(l.public_notes, '')
                ),
                ${csvDescription}
              ) >= 0.25
            ORDER BY similarity_score DESC
            LIMIT 1
          `;

          if (similarityResults.length === 1) {
            const match = similarityResults[0];

            if (!DRY_RUN) {
              await updateAed(match.id, defCodDea, Id, numeroProvisionalDea);
            }

            return {
              csv_row: row_number,
              Id,
              defCodDea,
              numeroProvisionalDea,
              csv_name: propuestaDenominacion,
              csv_address: csvAddress,
              csv_coords: csvCoords,
              csv_descripcion: descripcionAcceso,
              csv_comentario: comentarioLibre,
              db_id: match.id,
              db_name: match.name,
              db_address: formatAddress(
                match.street_type || "",
                match.street_name || "",
                match.street_number || ""
              ),
              db_coords:
                match.latitude && match.longitude ? `${match.latitude},${match.longitude}` : "",
              db_access_info: match.access_instructions || "",
              status: "OK",
              action: "MATCHED_NAME_DESCRIPTION",
              message: `Match por nombre + descripción (similarity: ${(match.similarity_score * 100).toFixed(0)}%)`,
              matches_found: 1,
            };
          }
        }
      }
    }
  }

  // Still multiple matches
  const ids = nameMatches.map((m) => m.id).join(", ");
  return {
    csv_row: row_number,
    Id,
    defCodDea,
    numeroProvisionalDea,
    csv_name: propuestaDenominacion,
    csv_address: csvAddress,
    csv_coords: csvCoords,
    csv_descripcion: descripcionAcceso,
    csv_comentario: comentarioLibre,
    db_id: null,
    db_name: null,
    db_address: null,
    db_coords: null,
    db_access_info: null,
    status: "WARNING",
    action: "MULTIPLE_MATCHES",
    message: `Múltiples matches (${nameMatches.length}). IDs: ${ids.substring(0, 100)}...`,
    matches_found: nameMatches.length,
  };
}

async function updateAed(
  aedId: string,
  defCodDea: string,
  Id: string,
  numeroProvisionalDea: string
): Promise<{ success: boolean; conflictingAedId?: string }> {
  // Verificar si el código ya existe en otro AED (solo si hay código)
  if (defCodDea) {
    const existingAed = await prisma.aed.findUnique({
      where: { code: defCodDea },
      select: { id: true },
    });

    // Si existe y NO es el mismo AED → CONFLICTO
    if (existingAed && existingAed.id !== aedId) {
      return {
        success: false,
        conflictingAedId: existingAed.id,
      };
    }
  }

  // Preparar datos a actualizar
  const updateData: {
    code?: string;
    external_reference: string;
    provisional_number: number | null;
  } = {
    external_reference: Id,
    provisional_number: numeroProvisionalDea ? parseInt(numeroProvisionalDea) : null,
  };

  // Solo actualizar code si tiene valor (no vacío)
  if (defCodDea) {
    updateData.code = defCodDea;
  }

  // Actualizar AED
  await prisma.aed.update({
    where: { id: aedId },
    data: updateData,
  });

  return { success: true };
}

function calculateStatistics(results: ProcessResult[]): Statistics {
  const stats: Statistics = {
    total: results.length,
    skipped: 0,
    matched_name: 0,
    matched_name_coords: 0,
    matched_name_address: 0,
    matched_name_description: 0,
    multiple_matches: 0,
    not_found: 0,
    code_conflicts: 0,
  };

  for (const result of results) {
    switch (result.action) {
      case "SKIPPED":
        stats.skipped++;
        break;
      case "MATCHED_NAME":
        stats.matched_name++;
        break;
      case "MATCHED_NAME_COORDS":
        stats.matched_name_coords++;
        break;
      case "MATCHED_NAME_ADDRESS":
        stats.matched_name_address++;
        break;
      case "MATCHED_NAME_DESCRIPTION":
        stats.matched_name_description++;
        break;
      case "MULTIPLE_MATCHES":
        stats.multiple_matches++;
        break;
      case "NOT_FOUND":
        stats.not_found++;
        break;
      case "CODE_CONFLICT":
        stats.code_conflicts++;
        break;
    }
  }

  return stats;
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log("🚀 Matching de DEAs - Ubicaciones Revisadas");
  console.log("=".repeat(60));
  console.log();

  if (DRY_RUN) {
    console.log("⚠️  MODO DRY-RUN ACTIVADO - No se harán cambios reales");
    console.log("   Para ejecutar cambios reales, use: --execute");
    console.log();
  } else {
    console.log("✅ MODO EJECUCIÓN - Los cambios se aplicarán a la base de datos");
    console.log();
  }

  try {
    ensureLogsDir();

    // Read CSV
    console.log("📂 Leyendo CSV:", CSV_INPUT_PATH);
    const csvContent = fs.readFileSync(CSV_INPUT_PATH, "utf-8");
    const rows = parseCSV(csvContent);
    console.log(`✅ Parseados ${rows.length} registros del CSV`);
    console.log();

    // Process all rows
    console.log("🔄 Procesando registros...");
    console.log();

    const results: ProcessResult[] = [];
    let processed = 0;

    for (const row of rows) {
      try {
        const result = await processRow(row);
        results.push(result);
        processed++;

        if (processed % 100 === 0) {
          console.log(`   Procesados ${processed}/${rows.length} registros...`);
        }
      } catch (error) {
        console.error(`❌ Error procesando fila ${row.row_number}:`, error);
        results.push({
          csv_row: row.row_number,
          Id: row.Id,
          defCodDea: row.defCodDea,
          numeroProvisionalDea: row.numeroProvisionalDea,
          csv_name: row.propuestaDenominacion,
          csv_address: formatAddress(row.finTIPO, row.finVIA, row.finNUM),
          csv_coords: `${row.finLAT},${row.finLON}`,
          csv_descripcion: row.descripcionAcceso,
          csv_comentario: row.comentarioLibre,
          db_id: null,
          db_name: null,
          db_address: null,
          db_coords: null,
          db_access_info: null,
          status: "ERROR",
          action: "NOT_FOUND",
          message: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
        });
      }
    }

    console.log(`✅ Procesamiento completado: ${processed}/${rows.length} registros`);
    console.log();

    // Generate output
    const outputFilename = getOutputFilename();
    const outputPath = path.join(LOGS_DIR, outputFilename);
    const csvOutput = generateCSVOutput(results);
    fs.writeFileSync(outputPath, csvOutput, { encoding: "utf8" });

    console.log("💾 Log CSV generado:", outputPath);
    console.log();

    // Statistics
    const stats = calculateStatistics(results);

    console.log("📊 ESTADÍSTICAS FINALES:");
    console.log("=".repeat(60));
    console.log(`  Total registros procesados:           ${stats.total}`);
    console.log();
    if (stats.skipped > 0) {
      console.log(`  ⏭️  Ya procesados (SKIPPED):          ${stats.skipped}`);
      console.log();
    }
    console.log(`  ✅ Match por nombre únicamente:       ${stats.matched_name}`);
    console.log(`  ✅ Match por nombre + coordenadas:    ${stats.matched_name_coords}`);
    console.log(`  ✅ Match por nombre + dirección:      ${stats.matched_name_address}`);
    console.log(`  ✅ Match por nombre + descripción:    ${stats.matched_name_description}`);
    console.log(`  ⚠️  Múltiples matches (ambiguos):     ${stats.multiple_matches}`);
    console.log(`  ⚠️  Conflictos de código:             ${stats.code_conflicts}`);
    console.log(`  ❌ No encontrados:                    ${stats.not_found}`);
    console.log();
    console.log(
      `  🎯 TOTAL MATCHED: ${
        stats.matched_name +
        stats.matched_name_coords +
        stats.matched_name_address +
        stats.matched_name_description
      }`
    );
    console.log();

    if (DRY_RUN) {
      console.log("⚠️  RECORDATORIO: Este fue un DRY-RUN");
      console.log("   Para aplicar los cambios reales, ejecute:");
      console.log("   npx tsx scripts/match-revisadas-by-location.ts --execute");
    } else {
      console.log("✅ Matching completado exitosamente");
    }

    console.log();
  } catch (error) {
    console.error("❌ Error fatal:", error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error("Error fatal:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
