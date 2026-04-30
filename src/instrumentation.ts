/**
 * Instrumentation for Next.js 16
 * Ejecuta cÃ³digo al iniciar el servidor
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Validate environment variables at startup (fail fast in production)
  const { getServerEnv } = await import("@/lib/env");
  getServerEnv();

  // La recuperaciÃ³n de batch jobs ahora se maneja mediante:
  // - POST /api/batch/recover - Recupera jobs con timeout
  // - GET /api/batch/recover - Lista jobs resumibles
  // No es necesario ejecutar recuperaciÃ³n automÃ¡tica al iniciar
}
