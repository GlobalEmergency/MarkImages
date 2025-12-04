/**
 * HeartbeatManager
 * Mantiene el heartbeat activo durante procesos largos de importación
 */

import type { PrismaClient } from "@/generated/client";

/**
 * Gestor de heartbeat para mantener vivo el estado de importaciones
 */
export class HeartbeatManager {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly batchId: string,
    private readonly intervalMs: number = 30000 // 30 segundos por defecto
  ) {}

  /**
   * Inicia el heartbeat automático
   */
  start(): void {
    if (this.isRunning) {
      console.warn("Heartbeat already running");
      return;
    }

    this.isRunning = true;
    console.log(`💓 Starting heartbeat for batch ${this.batchId} (interval: ${this.intervalMs}ms)`);

    // Actualizar inmediatamente
    this.updateHeartbeat().catch((error) => {
      console.error("Failed to update initial heartbeat:", error);
    });

    // Configurar intervalo
    this.intervalId = setInterval(() => {
      this.updateHeartbeat().catch((error) => {
        console.error("Failed to update heartbeat:", error);
      });
    }, this.intervalMs);
  }

  /**
   * Detiene el heartbeat
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log(`💓 Stopping heartbeat for batch ${this.batchId}`);

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
  }

  /**
   * Actualiza el timestamp del heartbeat
   */
  private async updateHeartbeat(): Promise<void> {
    try {
      await this.prisma.importBatch.update({
        where: { id: this.batchId },
        data: { last_heartbeat: new Date() },
      });
    } catch (error) {
      // Si falla la actualización, puede ser que el batch ya no exista
      console.error(`Failed to update heartbeat for batch ${this.batchId}:`, error);
      this.stop(); // Detener el heartbeat si hay error
    }
  }

  /**
   * Verifica si el heartbeat está activo
   */
  isActive(): boolean {
    return this.isRunning;
  }
}
