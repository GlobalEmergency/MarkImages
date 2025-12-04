# Guía de Testing del Sistema de Recuperación

## 🧪 Tests Automatizados

### Ejecutar el script de testing

```bash
npx tsx scripts/test-import-recovery.ts
```

Este script ejecuta 4 tests:

1. **CheckpointManager**: Verifica que los checkpoints se guarden y consulten correctamente
2. **HeartbeatManager**: Verifica que el heartbeat se actualice periódicamente
3. **ImportRecoveryService**: Verifica la detección de batches huérfanos
4. **Idempotencia**: Verifica que no se dupliquen registros al reanudar

### Resultado Esperado

```
============================================================
🚀 INICIANDO TESTS DEL SISTEMA DE RECUPERACIÓN
============================================================

🧪 TEST 1: CheckpointManager
============================================================
✅ Created test batch: ...
✅ Saved 5 checkpoints
✅ Last checkpoint index: 4 (expected: 4)
✅ Record 2 was processed: true (expected: true)
✅ Record 10 was processed: false (expected: false)
✅ Checkpoint stats: { total: 5, success: 5, ... }
✅ Cleaned up test batch

🧪 TEST 2: HeartbeatManager
============================================================
✅ Created test batch: ...
✅ Started heartbeat
✅ Heartbeat updated: ...
✅ Stopped heartbeat
✅ Cleaned up test batch

🧪 TEST 3: ImportRecoveryService
============================================================
✅ Created orphaned batch: ...
✅ Found 1 orphaned batch(es)
✅ Our test batch was detected: true (expected: true)
✅ Batch can be resumed: false (expected: false initially)
✅ Batch can be resumed now: true (expected: true)
✅ Found 1 resumable batch(es)
✅ Cleaned up test batch

🧪 TEST 4: Idempotencia (no duplicar registros)
============================================================
✅ Created test batch: ...
✅ Processed records 0-4
✅ Records to skip: [0, 1, 2, 3, 4] (expected: [0, 1, 2, 3, 4])
✅ Records to process: [5, 6, 7, 8, 9] (expected: [5, 6, 7, 8, 9])
✅ Idempotency test passed: true
✅ Cleaned up test batch

============================================================
📊 RESULTADOS
============================================================
Test 1 (CheckpointManager): ✅ PASSED
Test 2 (HeartbeatManager): ✅ PASSED
Test 3 (RecoveryService): ✅ PASSED
Test 4 (Idempotencia): ✅ PASSED

============================================================
🎉 TODOS LOS TESTS PASARON
============================================================
```

## 🔬 Testing Manual

### 1. Probar Detección de Importaciones Huérfanas

#### Paso 1: Iniciar una importación larga

```bash
# Desde la interfaz web o API, iniciar una importación con muchos registros
# La importación debe estar en progreso
```

#### Paso 2: Interrumpir el servidor

```bash
# Presionar Ctrl+C para detener el servidor durante la importación
```

#### Paso 3: Reiniciar el servidor

```bash
npm run dev
```

#### Resultado Esperado

```
============================================================
🔄 IMPORT RECOVERY SERVICE
============================================================
Environment: development
Enabled: true
Auto-resume: true
Heartbeat timeout: 300000ms
============================================================

🔍 Checking for orphaned import batches...

⚠️  Found 1 orphaned batch(es)

📦 Processing orphaned batch: Import Batch (uuid)
   Status: IN_PROGRESS
   Last heartbeat: 2025-01-04T00:30:00.000Z
   Progress: 450/1000
   Last checkpoint: 459
   🔄 Auto-resume enabled, will attempt to resume...

✅ Recovery process completed
```

### 2. Probar Reanudación Manual

#### Paso 1: Listar importaciones recuperables

```bash
curl http://localhost:3000/api/import/recovery
```

**Response esperado:**

```json
{
  "success": true,
  "count": 1,
  "batches": [
    {
      "id": "uuid",
      "name": "Import batch name",
      "status": "INTERRUPTED",
      "lastHeartbeat": "2025-01-04T...",
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

#### Paso 2: Reanudar la importación

```bash
curl -X POST http://localhost:3000/api/import/{batchId}/resume
```

**Response esperado:**

```json
{
  "success": true,
  "message": "Import resumption started",
  "batch": {
    "id": "uuid",
    "name": "Import batch name",
    "lastCheckpointIndex": 459,
    "progress": {
      "total": 1000,
      "success": 450,
      "failed": 10,
      "skipped": 0,
      "remaining": 540
    }
  }
}
```

#### Paso 3: Verificar logs del servidor

```
🚀 Resuming async import for batch uuid
📍 Resuming from checkpoint index: 459
📊 Current progress: 450 success, 10 failed
💓 Starting heartbeat for batch uuid (interval: 30000ms)
🔄 Processing chunk 10/20 (50 records)
⏭️  Skipping already processed record at index 459
✅ Processed 460 records successfully
...
✅ Import completed: 1000/1000 successful
💓 Stopping heartbeat for batch uuid
```

### 3. Probar Cancelación

#### Paso 1: Cancelar una importación activa

```bash
curl -X POST http://localhost:3000/api/import/{batchId}/cancel
```

**Response esperado:**

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

#### Paso 2: Reiniciar el servidor

```bash
# Ctrl+C y luego npm run dev
```

#### Resultado Esperado

El sistema **NO debe reanudar** la importación cancelada:

```
📦 Processing orphaned batch: Import Batch (uuid)
   ...
   ⛔ Batch was cancelled manually, marking as CANCELLED
```

### 4. Verificar Idempotencia (No Duplicación)

#### Consultar la base de datos

```sql
-- Ver checkpoints guardados
SELECT record_index, status, created_at
FROM import_checkpoints
WHERE import_batch_id = 'uuid'
ORDER BY record_index;

-- Verificar que no hay registros duplicados en aeds
SELECT import_batch_id, COUNT(*) as total
FROM aeds
WHERE import_batch_id = 'uuid'
GROUP BY import_batch_id;

-- El total debe coincidir con successful_records del batch
SELECT id, successful_records, total_records
FROM import_batches
WHERE id = 'uuid';
```

## ⚙️ Configuración para Testing

### Variables de Entorno

Para testing en desarrollo, puedes ajustar estas variables:

```env
# Habilitar recovery en desarrollo
IMPORT_RECOVERY_ENABLED="true"

# Reanudación automática (true) o manual (false)
IMPORT_RECOVERY_AUTO_RESUME="true"

# Intervalo de heartbeat (más frecuente para tests)
IMPORT_HEARTBEAT_INTERVAL_MS="5000"

# Timeout de heartbeat (más corto para tests)
IMPORT_HEARTBEAT_TIMEOUT_MS="30000"

# Frecuencia de checkpoints (más frecuente para tests)
IMPORT_CHECKPOINT_EVERY="5"
```

## 🐛 Troubleshooting

### El recovery no se ejecuta

**Posibles causas:**

- `IMPORT_RECOVERY_ENABLED` está en `false`
- Estás en desarrollo y no has habilitado explícitamente el recovery
- El archivo `src/instrumentation.ts` no existe

**Solución:**

```env
IMPORT_RECOVERY_ENABLED="true"
```

### Los checkpoints no se guardan

**Verificar:**

```sql
SELECT COUNT(*) FROM import_checkpoints WHERE import_batch_id = 'uuid';
```

Si es 0, revisar:

- Que el `checkpointManager` se pase al UseCase
- Los logs del servidor para ver errores

### La reanudación duplica registros

**Esto NO debería pasar**. Si ocurre:

1. Verificar que `isRecordProcessed()` funciona:

```typescript
const processed = await checkpointManager.isRecordProcessed(batchId, index);
console.log(`Record ${index} processed: ${processed}`);
```

2. Verificar la tabla de checkpoints:

```sql
SELECT * FROM import_checkpoints WHERE import_batch_id = 'uuid' ORDER BY record_index;
```

3. Revisar el log del UseCase para ver si salta registros:

```
⏭️  Skipping already processed record at index 459
```

## 📊 Métricas de Éxito

### Checklist de Funcionalidad

- [ ] El sistema detecta importaciones huérfanas al iniciar
- [ ] Los checkpoints se guardan cada N registros
- [ ] El heartbeat se actualiza cada 30 segundos
- [ ] La reanudación continúa desde el último checkpoint
- [ ] NO se duplican registros al reanudar
- [ ] Los contadores de éxito/fallo son correctos
- [ ] La cancelación manual se respeta (no reanuda)
- [ ] Las APIs de control manual funcionan correctamente

### KPIs del Sistema

- **Tasa de recuperación exitosa**: >95%
- **Registros duplicados**: 0
- **Tiempo de detección de huérfanos**: <10s al inicio
- **Overhead de checkpoints**: <5% del tiempo total

---

**Última actualización**: 2025-01-04  
**Mantenido por**: Equipo de Desarrollo
