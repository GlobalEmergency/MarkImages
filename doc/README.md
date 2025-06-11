# Documentación del Proyecto DEA Analizer

## 📚 Índice de Documentación

### 🔧 Migraciones y Base de Datos
- **[MIGRATION_CONSOLIDATION_SUMMARY.md](./MIGRATION_CONSOLIDATION_SUMMARY.md)** - Resumen completo de la consolidación de migraciones realizada
- **[MIGRATION_COMMANDS.md](./MIGRATION_COMMANDS.md)** - Guía completa de comandos npm para gestión de migraciones y base de datos

### ✅ Validación de Direcciones
- **[README_VALIDATION.md](./README_VALIDATION.md)** - Documentación del sistema de validación
- **[README_ADDRESS_VALIDATION.md](./README_ADDRESS_VALIDATION.md)** - Validación específica de direcciones de Madrid
- **[VALIDATION_FIX_SUMMARY.md](./VALIDATION_FIX_SUMMARY.md)** - Resumen de correcciones en el sistema de validación

### 🚀 Despliegue y Producción
- **[DEPLOYMENT_TROUBLESHOOTING.md](./DEPLOYMENT_TROUBLESHOOTING.md)** - Guía de resolución de problemas de despliegue
- **[VERCEL_PRISMA_FIX.md](./VERCEL_PRISMA_FIX.md)** - Soluciones específicas para Prisma en Vercel

### ⚡ Optimización
- **[OPTIMIZATION.md](./OPTIMIZATION.md)** - Guía de optimizaciones de rendimiento

## 🎯 Documentos Principales por Tema

### Para Desarrolladores Nuevos
1. [MIGRATION_COMMANDS.md](./MIGRATION_COMMANDS.md) - Comandos esenciales
2. [README_VALIDATION.md](./README_VALIDATION.md) - Sistema de validación
3. [DEPLOYMENT_TROUBLESHOOTING.md](./DEPLOYMENT_TROUBLESHOOTING.md) - Resolución de problemas

### Para Administradores de Sistema
1. [MIGRATION_CONSOLIDATION_SUMMARY.md](./MIGRATION_CONSOLIDATION_SUMMARY.md) - Estado actual de la BD
2. [VERCEL_PRISMA_FIX.md](./VERCEL_PRISMA_FIX.md) - Configuración de producción
3. [OPTIMIZATION.md](./OPTIMIZATION.md) - Optimizaciones aplicadas

### Para Resolución de Problemas
1. [DEPLOYMENT_TROUBLESHOOTING.md](./DEPLOYMENT_TROUBLESHOOTING.md) - Problemas de despliegue
2. [VALIDATION_FIX_SUMMARY.md](./VALIDATION_FIX_SUMMARY.md) - Problemas de validación
3. [VERCEL_PRISMA_FIX.md](./VERCEL_PRISMA_FIX.md) - Problemas específicos de Vercel

## 📋 Estado Actual del Proyecto

### Base de Datos
- ✅ **Migración consolidada**: `20250611082854_init_consolidated_optimized`
- ✅ **Datos cargados**: 213,427 direcciones de Madrid
- ✅ **Optimizaciones**: Índices espaciales y de texto completo

### Comandos Disponibles
```bash
# Gestión de migraciones
npm run migrate:status
npm run migrate:dev
npm run migrate:deploy
npm run migrate:reset

# Gestión de base de datos
npm run db:studio
npm run db:generate
npm run db:format

# Carga de datos
npm run load-madrid-data
```

### Estructura de Datos
- **21 distritos** de Madrid
- **131 barrios**
- **9,393 vías** (calles, avenidas, plazas)
- **11,066 rangos de numeración**
- **213,427 direcciones** con coordenadas geográficas

## 🔗 Enlaces Rápidos

- [Comandos de Migración](./MIGRATION_COMMANDS.md#comandos-de-migración)
- [Flujo de Trabajo Recomendado](./MIGRATION_COMMANDS.md#flujo-de-trabajo-recomendado)
- [Estadísticas de la Base de Datos](./MIGRATION_CONSOLIDATION_SUMMARY.md#estadísticas-de-carga)
- [Optimizaciones Aplicadas](./MIGRATION_CONSOLIDATION_SUMMARY.md#optimizaciones-incluidas)

## 📝 Notas de Versión

### Última Actualización: 11 de junio de 2025
- ✅ Consolidación completa de migraciones
- ✅ Comandos npm agregados para gestión de BD
- ✅ Documentación reorganizada en carpeta `doc/`
- ✅ Base de datos optimizada con índices especializados
- ✅ Sistema de validación de direcciones funcionando

---

**Mantenido por**: Equipo de desarrollo DEA Analizer  
**Última revisión**: 11/06/2025
