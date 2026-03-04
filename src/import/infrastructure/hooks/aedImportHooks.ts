/**
 * AED Import Lifecycle Hooks for @batchactions/import
 *
 * Implementa los hooks del pipeline de procesamiento de registros:
 * 1. beforeValidate â€” Normaliza datos raw (trim, lowercase, coordinate format)
 * 2. afterValidate  â€” Downgrade errores de duplicados cuando skipDuplicates=true
 * 3. beforeProcess  â€” Prepara datos para creaciÃ³n multi-entidad
 * 4. afterProcess   â€” Descarga imÃ¡genes y las sube a S3
 *
 * Pipeline completo en @batchactions/import:
 * Parse â†’ Alias resolution â†’ beforeValidate â†’ Transforms â†’ Validation â†’
 * Uniqueness â†’ afterValidate â†’ beforeProcess â†’ Processor â†’ afterProcess
 */

import type {
  JobHooks,
  RawRecord,
  ProcessedRecord,
  ParsedRecord,
  HookContext,
} from "@batchactions/import";
import type { DownloadAndUploadImageUseCase } from "@/storage/application/use-cases/DownloadAndUploadImageUseCase";
import type { SharePointAuthConfig } from "@/storage/domain/ports/IImageDownloader";
import type { PrismaClient } from "@/generated/client/client";
import { AedImageType } from "@/generated/client/enums";
import { randomUUID } from "crypto";
import { isSharePointUrl } from "@/shared/utils/sharepoint";

// ============================================================
// Tipos y constantes
// ============================================================

type ImageFieldKey =
  | "photo1Url"
  | "photo2Url"
  | "photo3Url"
  | "photoFrontUrl"
  | "photoLocationUrl"
  | "photoAccessUrl";

/** Mapeo de campo de imagen â†’ tipo de imagen en AedImage */
const IMAGE_FIELD_TO_TYPE: Record<ImageFieldKey, AedImageType> = {
  photoFrontUrl: AedImageType.FRONT,
  photoLocationUrl: AedImageType.LOCATION,
  photoAccessUrl: AedImageType.ACCESS,
  photo1Url: AedImageType.FRONT,
  photo2Url: AedImageType.LOCATION,
  photo3Url: AedImageType.CONTEXT,
};

/** Prioridad de campos de imagen (especÃ­ficos antes que genÃ©ricos) */
const IMAGE_FIELD_PRIORITY: ImageFieldKey[] = [
  // Nomenclatura especÃ­fica (prioridad)
  "photoFrontUrl",
  "photoLocationUrl",
  "photoAccessUrl",
  // Nomenclatura genÃ©rica (fallback)
  "photo1Url",
  "photo2Url",
  "photo3Url",
];

export interface AedImportHooksOptions {
  /** Prisma client para crear registros AedImage */
  prisma: PrismaClient;
  /** Use case para descargar imÃ¡genes y subirlas a S3 */
  downloadAndUploadImageUseCase?: DownloadAndUploadImageUseCase;
  /** AutenticaciÃ³n SharePoint (cookies rtFa/fedAuth) */
  sharePointAuth?: SharePointAuthConfig;
  /** Si true, los registros duplicados se procesan como warning en vez de error */
  skipDuplicates?: boolean;
}

// ============================================================
// beforeValidate: NormalizaciÃ³n de datos raw
// ============================================================

/**
 * Normaliza los datos crudos antes de que se apliquen transforms y validaciÃ³n.
 *
 * Operaciones:
 * - Trim de todos los valores string
 * - Normaliza coordenadas: coma â†’ punto decimal
 * - Normaliza booleans en espaÃ±ol a formato reconocido
 * - Limpia campos vacÃ­os (strings solo con espacios â†’ undefined)
 */
async function beforeValidate(record: RawRecord, _context: HookContext): Promise<RawRecord> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined) {
      normalized[key] = value;
      continue;
    }

    if (typeof value !== "string") {
      normalized[key] = value;
      continue;
    }

    const str = value.trim();

    // Limpiar strings vacÃ­os
    if (str === "") {
      normalized[key] = undefined;
      continue;
    }

    normalized[key] = str;
  }

  return normalized;
}

// ============================================================
// afterValidate: Ajustar severity de duplicados
// ============================================================

/**
 * DespuÃ©s de la validaciÃ³n, ajusta el comportamiento de duplicados:
 * - Si skipDuplicates=true, downgrade errores EXTERNAL_DUPLICATE de error â†’ warning
 *   para que el registro no se bloquee pero quede anotado
 */
function createAfterValidate(
  skipDuplicates: boolean
): ((record: ProcessedRecord, context: HookContext) => Promise<ProcessedRecord>) | undefined {
  if (!skipDuplicates) return undefined;

  return async (record: ProcessedRecord, _context: HookContext): Promise<ProcessedRecord> => {
    // Si no hay errores, no hay nada que ajustar
    if (!record.errors || record.errors.length === 0) return record;

    // Verificar si hay errores de duplicado externo
    const hasExternalDuplicate = record.errors.some((e) => e.code === "EXTERNAL_DUPLICATE");

    if (!hasExternalDuplicate) return record;

    // Downgrade EXTERNAL_DUPLICATE de error â†’ warning
    const adjustedErrors = record.errors.map((error) => {
      if (error.code === "EXTERNAL_DUPLICATE") {
        return {
          ...error,
          severity: "warning" as const,
        };
      }
      return error;
    });

    // Recalcular status: si solo quedan warnings, el record es vÃ¡lido
    const hasBlockingErrors = adjustedErrors.some((e) => (e.severity || "error") === "error");

    return {
      ...record,
      errors: adjustedErrors,
      status: hasBlockingErrors ? record.status : "valid",
    };
  };
}

// ============================================================
// beforeProcess: Preparar datos para multi-entity creation
// ============================================================

/**
 * Antes del processor callback, prepara los datos parseados:
 * - Detecta URLs de SharePoint en campos de imagen
 * - Marca el registro con metadata de SharePoint para el afterProcess
 * - Pre-genera UUIDs para AED e imÃ¡genes
 */
async function beforeProcess(record: ParsedRecord, _context: HookContext): Promise<ParsedRecord> {
  const enriched: Record<string, unknown> = { ...record };

  // Pre-generar UUID del AED para que las imÃ¡genes puedan referenciarlo
  if (!enriched._aedId) {
    enriched._aedId = randomUUID();
  }

  // Detectar si hay URLs de SharePoint en los campos de imagen
  let hasSharePoint = false;
  const imageUrls: Array<{ url: string; type: AedImageType; imageId: string; field: string }> = [];
  const seenUrls = new Set<string>();

  for (const field of IMAGE_FIELD_PRIORITY) {
    const url = enriched[field];
    if (typeof url !== "string" || !url.trim()) continue;

    const normalizedUrl = url.trim();

    // Evitar duplicados por URL
    if (seenUrls.has(normalizedUrl)) continue;
    seenUrls.add(normalizedUrl);

    // Detectar SharePoint
    if (isSharePointUrl(normalizedUrl)) {
      hasSharePoint = true;
    }

    imageUrls.push({
      url: normalizedUrl,
      type: IMAGE_FIELD_TO_TYPE[field],
      imageId: randomUUID(),
      field,
    });
  }

  // Almacenar metadata de imÃ¡genes para el afterProcess
  enriched._imageUrls = imageUrls;
  enriched._hasSharePoint = hasSharePoint;

  return enriched;
}

// ============================================================
// afterProcess: Descarga de imÃ¡genes â†’ S3 + creaciÃ³n AedImage
// ============================================================

/**
 * DespuÃ©s de que el processor crea el AED exitosamente,
 * descarga las imÃ¡genes desde URLs externas, las sube a S3,
 * y crea los registros AedImage en la base de datos.
 *
 * Las imÃ¡genes se procesan secuencialmente para no saturar el sistema.
 * Si una imagen falla, se crea un registro fallback con la URL original.
 */
function createAfterProcess(
  options: AedImportHooksOptions
): (record: ProcessedRecord, context: HookContext) => Promise<void> {
  const { prisma, downloadAndUploadImageUseCase, sharePointAuth } = options;

  return async (record: ProcessedRecord, _context: HookContext): Promise<void> => {
    const parsed = record.parsed as Record<string, unknown>;
    const aedId = parsed._aedId as string | undefined;
    const imageUrls = parsed._imageUrls as
      | Array<{
          url: string;
          type: AedImageType;
          imageId: string;
          field: string;
        }>
      | undefined;

    if (!aedId || !imageUrls || imageUrls.length === 0) return;

    // Procesar imÃ¡genes secuencialmente
    for (const [index, img] of imageUrls.entries()) {
      try {
        if (downloadAndUploadImageUseCase) {
          console.log(
            `[AedImportHooks] Processing image ${index + 1}/${imageUrls.length} for AED ${aedId}`
          );

          const s3Result = await downloadAndUploadImageUseCase.execute({
            url: img.url,
            aedId,
            imageId: img.imageId,
            sharePointAuth,
          });

          // Crear registro de imagen con URL de S3
          await prisma.aedImage.create({
            data: {
              id: img.imageId,
              aed_id: aedId,
              type: img.type,
              order: index + 1,
              original_url: s3Result.url,
              processed_url: null, // Se llena durante verificaciÃ³n
              is_verified: false,
            },
          });

          console.log(`[AedImportHooks] Image ${index + 1} uploaded to S3: ${s3Result.url}`);
        } else {
          // Fallback: guardar URL original si no hay use case de descarga
          console.warn(
            `[AedImportHooks] Image download not available. Saving original URL for image ${index + 1}`
          );
          await prisma.aedImage.create({
            data: {
              id: img.imageId,
              aed_id: aedId,
              type: img.type,
              order: index + 1,
              original_url: img.url,
              is_verified: false,
            },
          });
        }
      } catch (error) {
        // Error en imagen no debe fallar el AED completo
        console.error(
          `[AedImportHooks] Failed to process image ${index + 1} from ${img.url}:`,
          error instanceof Error ? error.message : error
        );

        // Fallback: crear registro con URL original
        try {
          await prisma.aedImage.create({
            data: {
              id: img.imageId,
              aed_id: aedId,
              type: img.type,
              order: index + 1,
              original_url: img.url,
              is_verified: false,
            },
          });
          console.log("[AedImportHooks] Created fallback image record with original URL");
        } catch (fallbackError) {
          console.error("[AedImportHooks] Failed to create fallback image record:", fallbackError);
        }
      }
    }
  };
}

// ============================================================
// Factory principal
// ============================================================

/**
 * Crea la configuraciÃ³n de hooks para la importaciÃ³n de AEDs.
 *
 * @example
 * ```typescript
 * const hooks = createAedImportHooks({
 *   prisma,
 *   downloadAndUploadImageUseCase,
 *   sharePointAuth: { rtFa: "...", fedAuth: "..." },
 *   skipDuplicates: true,
 * });
 *
 * const importer = new BulkImport({
 *   schema: aedImportSchema,
 *   hooks,
 *   // ...
 * });
 * ```
 */
export function createAedImportHooks(options: AedImportHooksOptions): JobHooks {
  const afterValidate = createAfterValidate(options.skipDuplicates ?? true);
  const afterProcess = createAfterProcess(options);

  return {
    beforeValidate,
    ...(afterValidate && { afterValidate }),
    beforeProcess,
    afterProcess,
  };
}
