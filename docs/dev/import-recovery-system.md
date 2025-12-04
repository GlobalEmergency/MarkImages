# Sistema de Recuperación de Importaciones

## 📋 Descripción

Sistema de recuperación automática para importaciones y migraciones que garantiza la continuidad del proceso incluso cuando el servidor se reinicia (por ejemplo, en desarrollo con hot reload o en producción por mantenimiento).

## 🎯 Características

- ✅ **Checkpoints granulares**: Guarda el progreso de cada registro procesado
- ✅ **Heartbeat automático**: Detecta procesos interrumpidos mediante timestamps
- ✅ **Recuperación automática**: Detecta importaciones huérfanas al iniciar el servidor
- ✅ **Reanudación inteligente**: Continúa desde el último registro procesado
- ✅ **Control manual**: APIs para reanudar o cancelar importaciones
- ✅ **Idempotencia**: No duplica registros al reanudar
- ✅ **Configuración flexible**: Variables de entorno para ajustar comportamiento

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────┐
│           Servidor Next.js (startup)                 │
├─────────────────────────────────────────────────────┤
│  src/instrumentation.ts                              │
│    └─> runImportRecovery()                          │
│        └─> ImportRecoveryService.runRecovery()     │
│            - Detecta batches huérfanos               │
│            - Marca como INTERRUPTED                  │
│            - Opcionalmente reanuda automáticamente   │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│         Proceso de Importación (mejorado)            │
├─────────────────────────────────────────────────────┤
│  processImportAsync()                                │
│    - Inicia HeartbeatManager                        │
│    - Consulta último checkpoint                      │
│    - Procesa desde último índice                     │
│    - Guarda checkpoints cada N registros            │
│    - Actualiza heartbeat cada 30s                    │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│              Base de Datos                           │
├─────────────────────────────────────────────────────┤
│  ImportBatch                                         │
│    - status (IN_PROGRESS, INTERRUPTED, etc.)        │
│    - last_heartbeat                                  │
│    - last_checkpoint_index                           │
│    - cancelled_manually                              │
│                                                      │
│  ImportCheckpoint                                    │
│    - record_index                                    │
│    - status (SUCCESS, FAILED, SKIPPED)              │
│    - record_hash (para idempotencia)                │
└─────────────────────────────────────────────────────┘
```

## 📊 Modelos de Base de Datos

### ImportBatch (actualizado)

```prisma
model ImportBatch {
  // ... campos existentes ...

  // Nuevos campos para recovery
  last_heartbeat        DateTime?
  last_checkpoint_index Int       @default(0)
  resumed_count         Int       @default(0)
  cancelled_manually    Boolean   @default(false)

  checkpoints           ImportCheckpoint[]
}
```

### ImportCheckpoint (nuevo)

```prisma
model ImportCheckpoint {
  id                  String   @id @default(uuid())
  import_batch_id     String
  record_index        Int
  record_reference    String?
  record_hash         String?

  status              CheckpointStatus
  error_message       String?
  processing_time_ms  Int?
  record_data         Json?

  import_batch        ImportBatch @relation(...)
  created_at          DateTime @default(now())

  @@unique([import_batch_id, record_index])
}

enum CheckpointStatus {
  SUCCESS
  FAILED
  SKIPPED
}
```

### Nuevos Estados de ImportStatus

- `INTERRUPTED`: Detectado como huérfano por el recovery service
- `RESUMING`: En proceso de reanudación
- (Mantiene estados existentes: PENDING, IN_PROGRESS, COMPLETED, etc.)

## 🔧 Componentes del Sistema

### 1. CheckpointManager

**Ubicación**: `src/lib/recovery/CheckpointManager.ts`

**Responsabilidades**:

- Guardar checkpoints de registros procesados
- Consultar último checkpoint procesado
- Verificar si un registro ya fue procesado
- Obtener estadísticas de progreso

**Métodos principales**:

```typescript
saveCheckpoint(data: CheckpointData): Promise<void>
getLastCheckpointIndex(batchId: string): Promise<number>
isRecordProcessed(batchId: string, recordIndex: number): Promise<boolean>
getCheckpointStats(batchId: string): Promise<CheckpointStats>
```

### 2. HeartbeatManager

**Ubicación**: `src/lib/recovery/HeartbeatManager.ts`

**Responsabilidades**:

- Actualizar `last_heartbeat` cada 30 segundos
- Mantener vivo el estado de la importación
- Permitir detectar procesos huérfanos

**Métodos principales**:

```typescript
start(): void
stop(): void
```

### 3. ImportRecoveryService

**Ubicación**: `src/lib/recovery/ImportRecoveryService.ts`

**Responsabilidades**:

- Detectar batches huérfanos al iniciar servidor
- Marcar batches como INTERRUPTED
- Verificar si un batch puede reanudarse
- Preparar batches para reanudación

**Métodos principales**:

```typescript
runRecovery(): Promise<void>
findOrphanedBatches(): Promise<OrphanedBatch[]>
canBatchBeResumed(batchId: string): Promise<boolean>
prepareBatchForResume(batchId: string): Promise<void>
listResumableBatches(): Promise<OrphanedBatch[]>
```

### 4. Instrumentación de Next.js

**Ubicación**: `src/instrumentation.ts`

Se ejecuta automáticamente al iniciar el servidor Next.js 16.

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runImportRecovery } = await import("./lib/recovery/runImportRecovery");
    await runImportRecovery();
  }
}
```

## 🔌 APIs de Control Manual

### GET /api/import/recovery

Lista todas las importaciones que pueden ser reanudadas.

**Response**:

```json
{
  "success": true,
  "count": 2,
  "batches": [
    {
      "id": "uuid",
      "name": "Import batch name",
      "status": "INTERRUPTED",
      "lastHeartbeat": "2025-01-03T...",
      "progress": {
        "total": 1000,
        "successful": 450,
        "failed": 10,
        "lastCheckpointIndex": 459,
        "remaining": 540,
        "percentage": 45
      }
    }
  ]
}
```

### POST /api/import/[batchId]/resume

Reanuda una importación interrumpida.

**Response**:

```json
{
  "success": true,
  "message": "Import resumption started",
  "batch": {
    "id": "uuid",
    "name": "Import batch name",
    "lastCheckpointIndex": 459,
    "progress": { ... }
  }
}
```

### POST /api/import/[batchId]/cancel

Cancela una importación (en progreso o interrumpida).

**Response**:

```json
{
  "success": true,
  "message": "Import cancelled successfully",
  "batch": {
    "id": "uuid",
    "name": "Import batch name",
    "previousStatus": "IN_PROGRESS",
    "newStatus": "CANCELLED"
  }
}
```

## ⚙️ Configuración

### Variables de Entorno

Agregar a `.env` o `.env.local`:

```env
# Import Recovery System
IMPORT_RECOVERY_ENABLED="true"
IMPORT_RECOVERY_AUTO_RESUME="true"
IMPORT_HEARTBEAT_INTERVAL_MS="30000"
IMPORT_HEARTBEAT_TIMEOUT_MS="300000"
IMPORT_CHECKPOINT_EVERY="10"
```

### Descripción de Variables

| Variable                       | Descripción                                      | Valor por Defecto |
| ------------------------------ | ------------------------------------------------ | ----------------- |
| `IMPORT_RECOVERY_ENABLED`      | Habilita/deshabilita el sistema de recuperación  | `true`            |
| `IMPORT_RECOVERY_AUTO_RESUME`  | Reanuda automáticamente importaciones al iniciar | `true`            |
| `IMPORT_HEARTBEAT_INTERVAL_MS` | Intervalo de actualización del heartbeat         | `30000` (30s)     |
| `IMPORT_HEARTBEAT_TIMEOUT_MS`  | Tiempo sin heartbeat para considerar huérfano    | `300000` (5min)   |
| `IMPORT_CHECKPOINT_EVERY`      | Frecuencia de guardado de checkpoints            | `10` registros    |

### Comportamiento en Desarrollo

Por defecto, el recovery está **deshabilitado en desarrollo** para evitar interferencias con hot reload:

```typescript
if (process.env.NODE_ENV === "development" && !process.env.IMPORT_RECOVERY_ENABLED) {
  console.log("🔄 Import recovery disabled in development mode");
  return;
}
```

Para habilitarlo explícitamente en desarrollo:

```env
IMPORT_RECOVERY_ENABLED="true"
```

## 🚀 Flujo de Uso

### Escenario 1: Importación Normal (Sin Interrupciones)

1. Usuario inicia importación
2. Sistema crea batch con estado `PENDING`
3. Proceso inicia (`IN_PROGRESS`)
4. HeartbeatManager actualiza `last_heartbeat` cada 30s
5. CheckpointManager guarda progreso cada 10 registros
6. Importación completa exitosamente (`COMPLETED`)

### Escenario 2: Servidor se Reinicia Durante Importación

1. Importación en progreso (`IN_PROGRESS`)
2. **Servidor se reinicia** (npm run dev, deploy, etc.)
3. Al iniciar, `instrumentation.ts` ejecuta recovery
4. ImportRecoveryService detecta batch huérfano (sin heartbeat reciente)
5. Marca batch como `INTERRUPTED`
6. Si `IMPORT_RECOVERY_AUTO_RESUME=true`:
   - Prepara batch para reanudación
   - Lee último checkpoint
   - Reanuda desde siguiente registro
7. Si `IMPORT_RECOVERY_AUTO_RESUME=false`:
   - Usuario debe llamar `POST /api/import/[batchId]/resume`

### Escenario 3: Usuario Cancela Importación

1. Usuario llama `POST /api/import/[batchId]/cancel`
2. Sistema marca `cancelled_manually=true` y `status=CANCELLED`
3. Al reiniciar servidor, recovery detecta `cancelled_manually=true`
4. **NO reanuda** automáticamente (respeta cancelación)

## 📝 Logs del Sistema

### Al Iniciar Servidor

```
============================================================
🔄 IMPORT RECOVERY SERVICE
============================================================
Environment: production
Enabled: true
Auto-resume: true
Heartbeat timeout: 300000ms
============================================================

🔍 Checking for orphaned import batches...

⚠️  Found 1 orphaned batch(es)

📦 Processing orphaned batch: Import Batch 2025-01-03 (uuid)
   Status: IN_PROGRESS
   Last heartbeat: 2025-01-03T22:30:00.000Z
   Progress: 450/1000
   Last checkpoint: 459
   🔄 Auto-resume enabled, will attempt to resume...

✅ Recovery process completed
```

### Durante Importación

```
🚀 Resuming async import for batch uuid
📍 Resuming from checkpoint index: 459
💓 Starting heartbeat for batch uuid (interval: 30000ms)
...
✅ Import completed: 1000/1000 successful
💓 Stopping heartbeat for batch uuid
```

## 🧪 Testing Manual

### 1. Probar Detección de Huérfanos

```bash
# 1. Iniciar una importación larga
# 2. Durante la importación, reiniciar el servidor: Ctrl+C
# 3. Iniciar servidor nuevamente: npm run dev
# 4. Verificar logs: debe detectar batch huérfano
```

### 2. Probar Reanudación Manual

```bash
# 1. Obtener lista de batches recuperables
curl http://localhost:3000/api/import/recovery

# 2. Reanudar un batch específico
curl -X POST http://localhost:3000/api/import/{batchId}/resume

# 3. Verificar logs de progreso
```

### 3. Probar Cancelación

```bash
# 1. Cancelar importación
curl -X POST http://localhost:3000/api/import/{batchId}/cancel

# 2. Reiniciar servidor
# 3. Verificar que NO reanuda (debe decir "cancelled manually")
```

## 🐛 Troubleshooting

### Recovery no se ejecuta al iniciar

**Causa**: `instrumentation.ts` no se está ejecutando

**Solución**:

1. Verificar que el archivo existe en `src/instrumentation.ts`
2. Reiniciar servidor completamente
3. Verificar logs de inicio

### Heartbeat se detiene

**Causa**: Proceso de importación terminó o falló

**Solución**: El HeartbeatManager se detiene automáticamente en el `finally` block

### Checkpoints no se guardan

**Causa**: Error en la transacción de guardado

**Solución**: Revisar logs de error en `CheckpointManager.saveCheckpoint()`

### Importación se reanuda desde cero

**Causa**: Checkpoints no se están guardando o consultando correctamente

**Solución**:

1. Verificar tabla `import_checkpoints` en BD
2. Verificar campo `last_checkpoint_index` en `import_batches`
3. Revisar logs de `getLastCheckpointIndex()`

## 📚 Referencias

- [Next.js 16 Instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)
- [Prisma Transactions](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
- Arquitectura: DDD + Hexagonal + Outside-In

## ✅ Sistema Completamente Funcional

El sistema de recuperación de importaciones está **100% implementado y funcional**:

- ✅ Checkpoints granulares guardados cada N registros
- ✅ Heartbeat automático actualizado cada 30s
- ✅ Detección automática de importaciones huérfanas al inicio
- ✅ Reanudación automática (configurable) o manual
- ✅ Verificación de registros ya procesados (idempotencia)
- ✅ APIs de control manual (resume/cancel/list)
- ✅ Integración completa en `ImportDeaBatchUseCase`
- ✅ Logging detallado de todo el proceso

### 🎯 Cómo Funciona en Producción

1. **Durante la importación**:
   - Se guarda un checkpoint cada 10 registros (configurable)
   - Se actualiza el heartbeat cada 30 segundos
   - Se registra cada fallo con su contexto

2. **Si el servidor se reinicia**:
   - Al iniciar, detecta importaciones sin heartbeat reciente
   - Las marca como `INTERRUPTED`
   - Si `IMPORT_RECOVERY_AUTO_RESUME=true`, las reanuda automáticamente
   - Si es `false`, esperará a que el usuario las reanude manualmente

3. **Al reanudar**:
   - Lee el último checkpoint guardado
   - Salta todos los registros ya procesados
   - Continúa desde el siguiente registro sin duplicar
   - Mantiene el contador de éxitos/fallos correctamente

## 🔄 Próximas Mejoras (Opcionales)

- [ ] Agregar UI para gestionar importaciones interrumpidas
- [ ] Métricas de recuperación en dashboard
- [ ] Notificaciones push cuando se detecta interrupción
- [ ] Retry automático de registros fallidos
- [ ] Cleanup automático de checkpoints antiguos (>30 días)
- [ ] Exportar checkpoints como backup

---

**Última actualización**: 2025-01-04  
**Versión**: 2.0.0  
**Estado**: Completamente Funcional ✅
