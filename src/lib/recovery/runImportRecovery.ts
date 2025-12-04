/**
 * Run Import Recovery
 * Función que se ejecuta al iniciar el servidor para detectar y recuperar importaciones huérfanas
 */

import { prisma } from "@/lib/db";
import { ImportRecoveryService } from "./ImportRecoveryService";

/**
 * Ejecuta el proceso de recuperación de importaciones
 * Configuración mediante variables de entorno
 */
export async function runImportRecovery(): Promise<void> {
  // Leer configuración desde variables de entorno
  const config = {
    enabled: process.env.IMPORT_RECOVERY_ENABLED !== "false", // Habilitado por defecto
    autoResume: process.env.IMPORT_RECOVERY_AUTO_RESUME === "true", // Deshabilitado por defecto
    heartbeatTimeoutMs: parseInt(
      process.env.IMPORT_HEARTBEAT_TIMEOUT_MS || "300000" // 5 minutos
    ),
  };

  // En desarrollo, deshabilitar recovery por defecto (demasiados reinicios con hot reload)
  if (process.env.NODE_ENV === "development" && !process.env.IMPORT_RECOVERY_ENABLED) {
    console.log("🔄 Import recovery disabled in development mode");
    return;
  }

  console.log("\n" + "=".repeat(60));
  console.log("🔄 IMPORT RECOVERY SERVICE");
  console.log("=".repeat(60));
  console.log(`Environment: ${process.env.NODE_ENV || "unknown"}`);
  console.log(`Enabled: ${config.enabled}`);
  console.log(`Auto-resume: ${config.autoResume}`);
  console.log(`Heartbeat timeout: ${config.heartbeatTimeoutMs}ms`);
  console.log("=".repeat(60) + "\n");

  if (!config.enabled) {
    console.log("⏭️  Import recovery is disabled\n");
    return;
  }

  try {
    const recoveryService = new ImportRecoveryService(prisma, config);
    await recoveryService.runRecovery();
  } catch (error) {
    console.error("❌ Failed to run import recovery:", error);
    // No lanzar el error para no bloquear el inicio del servidor
  } finally {
    // No desconectar prisma aquí, ya que se usará en el resto de la aplicación
    console.log(""); // Línea en blanco
  }
}
