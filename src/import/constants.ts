/**
 * Import Module Constants
 *
 * Centraliza los valores de configuraciÃ³n del mÃ³dulo de importaciÃ³n.
 * Cada constante lee de process.env con un fallback sensato por defecto,
 * permitiendo overridear vÃ­a .env sin necesidad de cambiar cÃ³digo.
 *
 * Las constantes de dominio/estructura (delimitador, tamaÃ±o mÃ¡ximo) NO
 * se exponen a .env porque son convenciones del sistema, no del entorno.
 */

// ============================================================
// Helper
// ============================================================

/** Parsea una env var numÃ©rica con fallback */
function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? fallback : parsed;
}

// ============================================================
// Vercel Serverless Timeouts (configurables por entorno)
// ============================================================

/**
 * DuraciÃ³n mÃ¡xima de la API route POST /api/import (primer chunk).
 * Vercel Pro tiene 300s, dejamos margen para respuesta.
 * @env IMPORT_API_MAX_DURATION_MS (default: 80000)
 */
export const VERCEL_API_MAX_DURATION_MS = envInt("IMPORT_API_MAX_DURATION_MS", 80_000);

/**
 * DuraciÃ³n mÃ¡xima por chunk en CRON jobs.
 * Vercel Cron tiene ~60s, dejamos 15s buffer.
 * @env IMPORT_CRON_MAX_DURATION_MS (default: 45000)
 */
export const VERCEL_CRON_MAX_DURATION_MS = envInt("IMPORT_CRON_MAX_DURATION_MS", 45_000);

/**
 * Timeout de seguridad para el CRON handler.
 * Si el elapsed time supera este valor, no se inician mÃ¡s jobs.
 * Deja 10s de buffer para la respuesta HTTP.
 * @env IMPORT_CRON_SAFETY_TIMEOUT_MS (default: 50000)
 */
export const CRON_SAFETY_TIMEOUT_MS = envInt("IMPORT_CRON_SAFETY_TIMEOUT_MS", 50_000);

// ============================================================
// Job Management (configurables por entorno)
// ============================================================

/**
 * Timeout para detectar jobs huÃ©rfanos (sin heartbeat).
 * Si un job IN_PROGRESS no actualiza su heartbeat en este tiempo,
 * se marca como INTERRUPTED para recovery.
 * @env IMPORT_ORPHANED_JOB_TIMEOUT_MS (default: 180000 = 3 min)
 */
export const ORPHANED_JOB_TIMEOUT_MS = envInt("IMPORT_ORPHANED_JOB_TIMEOUT_MS", 180_000);

/**
 * NÃºmero mÃ¡ximo de jobs procesados por invocaciÃ³n del CRON.
 * Limita el impacto en caso de muchos jobs acumulados.
 * @env IMPORT_CRON_MAX_JOBS (default: 5)
 */
export const CRON_MAX_JOBS_PER_INVOCATION = envInt("IMPORT_CRON_MAX_JOBS", 5);

/**
 * TamaÃ±o de batch por defecto (registros por chunk).
 * @env IMPORT_BATCH_SIZE (default: 50)
 */
export const DEFAULT_BATCH_SIZE = envInt("IMPORT_BATCH_SIZE", 50);

/**
 * NÃºmero mÃ¡ximo de registros por chunk.
 * Safety cap adicional a maxDurationMs para garantizar que un chunk
 * no procese mÃ¡s registros de los razonables, independientemente del tiempo.
 * @env IMPORT_CHUNK_MAX_RECORDS (default: 500)
 */
export const DEFAULT_CHUNK_MAX_RECORDS = envInt("IMPORT_CHUNK_MAX_RECORDS", 500);

// ============================================================
// Import Defaults (constantes de dominio, no configurables)
// ============================================================

/** Delimitador CSV por defecto (punto y coma, convenciÃ³n espaÃ±ola/europea) */
export const DEFAULT_CSV_DELIMITER = ";";

/** TamaÃ±o mÃ¡ximo de archivo CSV en bytes (100 MB) â€” lÃ­mite de seguridad */
export const MAX_CSV_FILE_SIZE_BYTES = 100 * 1024 * 1024;
