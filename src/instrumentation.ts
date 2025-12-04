/**
 * Instrumentation for Next.js 16
 * Ejecuta código al iniciar el servidor
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Solo ejecutar en el servidor
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runImportRecovery } = await import("./lib/recovery/runImportRecovery");

    // Ejecutar recuperación de importaciones
    await runImportRecovery();
  }
}
