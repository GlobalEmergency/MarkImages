# 🔄 Instrucciones de Migración - Reset de Base de Datos

Este documento describe cómo aplicar el nuevo esquema de base de datos después del reset completo.

## 📋 Cambios Realizados

- ✅ **Schema actualizado**: El archivo `prisma/schema.prisma` ha sido completamente reemplazado con el nuevo esquema
- ✅ **Migraciones eliminadas**: Todas las migraciones antiguas han sido eliminadas
- ✅ **Migración inicial creada**: Nueva migración única en `prisma/migrations/20250126000000_init/`
- ✅ **Seeds actualizados**: El archivo `prisma/seed.ts` ha sido actualizado para el nuevo esquema

## 🚀 Pasos para Aplicar la Migración

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Resetear la Base de Datos

Este comando eliminará todos los datos existentes y aplicará la nueva migración:

```bash
npx prisma migrate reset
```

**⚠️ ADVERTENCIA**: Este comando:
- Eliminará TODOS los datos de la base de datos
- Aplicará la migración inicial `20250126000000_init`
- Ejecutará automáticamente el seed con datos de ejemplo

### 3. Alternativa: Aplicar Migración sin Seed

Si prefieres aplicar la migración sin ejecutar el seed:

```bash
npx prisma migrate reset --skip-seed
```

### 4. Ejecutar Seed Manualmente (Opcional)

Si omitiste el seed en el paso anterior:

```bash
npm run db:seed
```

## 📊 Nuevo Esquema de Base de Datos

### Modelos Principales

1. **Aed** - Desfibriladores automáticos externos
   - Información completa del DEA
   - Coordenadas geoespaciales (con soporte PostGIS)
   - Estados: DRAFT, PENDING_REVIEW, VERIFIED, PUBLISHED, SUSPENDED, ARCHIVED

2. **AedLocation** - Ubicaciones
   - Dirección completa
   - Coordenadas
   - Relaciones con sistema de direcciones oficial

3. **AedResponsible** - Responsables
   - Información de contacto
   - Organización

4. **AedSchedule** - Horarios
   - Horarios estructurados por día
   - Configuración de acceso

5. **AedImage** - Imágenes
   - Múltiples tipos: FRONT, LOCATION, ACCESS, SIGNAGE, CONTEXT, PLATE
   - Estado de verificación

6. **AedValidation** - Validaciones
   - Tipos: IMAGES, ADDRESS, SCHEDULE, AVAILABILITY, DUPLICATE, MANUAL
   - Historial de sesiones

7. **ImportBatch** - Importaciones masivas
   - Trazabilidad de lotes
   - Estadísticas de proceso

8. **Sistema de Direcciones Oficial**
   - District, Neighborhood, Street, Address
   - StreetNumberRange

9. **Auditoría y Métricas**
   - AuditLog
   - SystemMetric

### Enums Importantes

- **AedStatus**: Estados del DEA
- **SourceOrigin**: Origen de los datos (WEB_FORM, ADMIN_FORM, EXCEL_IMPORT, etc.)
- **ValidationType**: Tipos de validación
- **ValidationStatus**: Estados de validación
- **ImportStatus**: Estados de importación

## 🌱 Datos de Ejemplo (Seed)

El seed crea:
- 2 distritos (Usera, Centro)
- 2 responsables
- 2 horarios
- 2 ubicaciones
- 2 AEDs en estado PUBLISHED
- 2 códigos históricos
- 4 cambios de estado

## 🔍 Verificar el Estado

### Ver migraciones aplicadas

```bash
npx prisma migrate status
```

### Abrir Prisma Studio

```bash
npm run db:studio
```

### Generar cliente de Prisma

Si necesitas regenerar el cliente:

```bash
npx prisma generate
```

## ⚙️ Extensiones Requeridas

El nuevo esquema requiere la extensión **PostGIS** para PostgreSQL:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Esta extensión se crea automáticamente al ejecutar la migración.

## 📝 Notas Importantes

1. **PostGIS**: El nuevo esquema utiliza PostGIS para búsquedas geoespaciales eficientes
2. **UUIDs**: Los IDs principales ahora usan UUID en lugar de autoincrement
3. **Normalización**: El esquema está completamente normalizado con relaciones claras
4. **Auditoría**: Sistema completo de auditoría y trazabilidad
5. **Validaciones**: Sistema robusto de validación con múltiples tipos

## 🔧 Troubleshooting

### Error: "Extension postgis not found"

```bash
# En PostgreSQL, instalar PostGIS
sudo apt-get install postgresql-postgis
# o en Docker
# Usar imagen con PostGIS: postgis/postgis:latest
```

### Error: "Migration failed"

1. Verificar que la base de datos esté vacía o usar `--force`:
   ```bash
   npx prisma migrate reset --force
   ```

2. Verificar conexión a la base de datos en `.env`:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
   ```

## 📚 Documentación Adicional

- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)

---

**Última actualización**: 2025-01-26
**Migración**: `20250126000000_init`
