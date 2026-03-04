# Migración de Datos: Asignar DEAs Existentes a SAMUR Madrid

## 📋 Descripción

Esta migración asigna todos los DEAs existentes en la base de datos a la organización **SAMUR - Protección Civil Madrid** y configura los datos geográficos para la ciudad de Madrid.

## 🎯 ¿Qué hace esta migración?

1. **Crea la organización SAMUR Madrid** (si no existe)
   - Tipo: `CIVIL_PROTECTION`
   - Código: `SAMUR_MADRID`
   - Ámbito: Ciudad de Madrid (código INE: 28079)
   - Badge: "Verificado por SAMUR" 🚒

2. **Actualiza ubicaciones**
   - Asigna código de ciudad `28079` (Madrid) a todas las ubicaciones sin código
   - Establece `city_name` como "Madrid"

3. **Crea asignaciones**
   - Asigna todos los DEAs sin asignación a SAMUR Madrid
   - Tipo de asignación: `CIVIL_PROTECTION`
   - `publication_mode` según el estado actual:
     - `PUBLISHED` → Mantiene `publication_mode` actual o `FULL`
     - `PENDING_REVIEW` → `LOCATION_ONLY`
     - `DRAFT/INACTIVE/REJECTED` → `NONE`

4. **Crea verificaciones**
   - Para todos los DEAs con estado `PUBLISHED`
   - Tipo: `INFORMAL`
   - Marca todos los aspectos como verificados (address, schedule, photos, access)

## 🚀 Métodos de Ejecución

### Opción A: Script TypeScript (Recomendado)

```bash
# Instalar dependencias si no están instaladas
npm install

# Ejecutar el script
npx tsx scripts/migrate-to-samur-madrid.ts
```

**Ventajas:**

- ✅ Más seguro (usa Prisma con validaciones)
- ✅ Manejo de errores robusto
- ✅ Logs detallados del progreso
- ✅ Idempotente (se puede ejecutar múltiples veces)

### Opción B: Migración SQL Directa

```bash
# Aplicar la migración SQL directamente
psql -U postgres -d deamap -f prisma/migrations/20251216000001_assign_existing_aeds_to_samur/migration.sql
```

**Ventajas:**

- ✅ Más rápido para grandes volúmenes
- ✅ No requiere dependencias de Node.js

### Opción C: Prisma Migrate Deploy

```bash
# Aplicar todas las migraciones pendientes
npx prisma migrate deploy
```

**Nota:** Esto aplicará TODAS las migraciones pendientes, incluida esta.

## 📊 Salida Esperada

### Script TypeScript

```
🚀 Starting data migration to SAMUR Madrid...

📋 Step 1: Creating SAMUR Madrid organization...
✅ SAMUR Madrid organization created: <uuid>

📍 Step 2: Updating locations with Madrid city code...
✅ Updated 523 locations with Madrid city code

🏥 Step 3: Finding AEDs without organization assignments...
📊 Found 523 total AEDs
📊 Found 523 AEDs without assignments

🔗 Step 4: Creating assignments to SAMUR Madrid...
   Processed 100 AEDs...
   Processed 200 AEDs...
   Processed 300 AEDs...
   Processed 400 AEDs...
   Processed 500 AEDs...
✅ Created 523 assignments
✅ Created 487 verifications

📊 Migration Summary:
==================================================

Assignments by status and publication mode:
  ACTIVE - FULL: 487 AEDs
  ACTIVE - LOCATION_ONLY: 28 AEDs
  ACTIVE - NONE: 8 AEDs

Total current verifications: 487

✅ Migration completed successfully!
```

### SQL Migration

```
NOTICE:  Migration completed:
NOTICE:    - SAMUR Madrid organizations: 1
NOTICE:    - Total assignments: 523
NOTICE:    - Total verifications: 487
```

## 🔍 Verificación Post-Migración

Después de ejecutar la migración, verifica que todo esté correcto:

```sql
-- Ver la organización SAMUR Madrid
SELECT * FROM organizations WHERE code = 'SAMUR_MADRID';

-- Contar asignaciones por estado
SELECT
  status,
  publication_mode,
  COUNT(*) as total
FROM aed_organization_assignments
WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SAMUR_MADRID')
GROUP BY status, publication_mode;

-- Contar verificaciones
SELECT COUNT(*) as total_verifications
FROM aed_organization_verifications
WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SAMUR_MADRID')
  AND is_current = true;

-- Ver DEAs sin asignación (debería ser 0)
SELECT COUNT(*) as unassigned_aeds
FROM aeds a
WHERE NOT EXISTS (
  SELECT 1
  FROM aed_organization_assignments aoa
  WHERE aoa.aed_id = a.id AND aoa.status = 'ACTIVE'
);
```

## ⚠️ Consideraciones Importantes

1. **Idempotencia**: El script puede ejecutarse múltiples veces sin duplicar datos
2. **No destructivo**: No elimina ni modifica DEAs existentes, solo crea relaciones
3. **Reversible**: Si es necesario, se pueden eliminar las asignaciones:

   ```sql
   DELETE FROM aed_organization_assignments
   WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SAMUR_MADRID');

   DELETE FROM aed_organization_verifications
   WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SAMUR_MADRID');

   DELETE FROM organizations WHERE code = 'SAMUR_MADRID';
   ```

4. **Backups**: Siempre haz un backup antes de ejecutar migraciones en producción:
   ```bash
   pg_dump -U postgres deamap > backup_before_migration.sql
   ```

## 🎯 Casos de Uso Post-Migración

Después de esta migración, podrás:

1. **Ver todos los DEAs asignados a SAMUR Madrid** en el panel de gestión
2. **Filtrar DEAs por organización** en las APIs
3. **Gestionar permisos** de usuarios dentro de SAMUR Madrid
4. **Crear nuevas organizaciones** y reasignar DEAs si es necesario
5. **Mantener historial** de cambios y verificaciones

## 📞 Soporte

Si encuentras problemas durante la migración:

1. Revisa los logs del script
2. Verifica las queries SQL en la migración
3. Consulta el estado de la base de datos
4. Restaura el backup si es necesario

## ✅ Checklist Post-Migración

- [ ] Migración ejecutada sin errores
- [ ] Organización SAMUR Madrid creada
- [ ] Todos los DEAs tienen asignación activa
- [ ] DEAs publicados tienen verificaciones
- [ ] Ubicaciones tienen código de ciudad de Madrid
- [ ] APIs funcionan correctamente con el nuevo sistema
- [ ] Permisos de usuarios configurados correctamente
