# Comandos de Migración y Base de Datos

## 🚀 Comandos Agregados al package.json

### Comandos de Migración

#### `npm run migrate:status`
```bash
npm run migrate:status
```
- **Función**: Verifica el estado actual de las migraciones
- **Uso**: Muestra qué migraciones están aplicadas y cuáles están pendientes
- **Cuándo usar**: Antes de hacer cambios o para verificar el estado actual

#### `npm run migrate:dev`
```bash
npm run migrate:dev
```
- **Función**: Aplica migraciones pendientes en desarrollo
- **Uso**: Ejecuta migraciones no aplicadas y regenera el cliente Prisma
- **Cuándo usar**: Durante desarrollo cuando hay nuevas migraciones

#### `npm run migrate:deploy`
```bash
npm run migrate:deploy
```
- **Función**: Aplica migraciones en producción
- **Uso**: Ejecuta migraciones pendientes sin preguntas interactivas
- **Cuándo usar**: En despliegues de producción o CI/CD

#### `npm run migrate:reset`
```bash
npm run migrate:reset
```
- **Función**: Resetea completamente la base de datos
- **Uso**: Elimina todos los datos y reaplica todas las migraciones
- **⚠️ CUIDADO**: Elimina todos los datos existentes

#### `npm run migrate:diff`
```bash
npm run migrate:diff
```
- **Función**: Compara el schema actual con la base de datos
- **Uso**: Muestra diferencias entre el schema y la BD actual
- **Cuándo usar**: Para verificar si hay cambios pendientes

### Comandos de Base de Datos

#### `npm run db:studio`
```bash
npm run db:studio
```
- **Función**: Abre Prisma Studio (interfaz visual)
- **Uso**: Navegar y editar datos de la base de datos visualmente
- **Puerto**: Generalmente http://localhost:5555

#### `npm run db:generate`
```bash
npm run db:generate
```
- **Función**: Regenera el cliente Prisma
- **Uso**: Actualiza el cliente después de cambios en el schema
- **Cuándo usar**: Después de modificar prisma/schema.prisma

#### `npm run db:format`
```bash
npm run db:format
```
- **Función**: Formatea el archivo schema.prisma
- **Uso**: Aplica formato consistente al schema
- **Cuándo usar**: Antes de commits para mantener consistencia

## 📋 Flujo de Trabajo Recomendado

### 1. Verificar Estado Actual
```bash
npm run migrate:status
```

### 2. Aplicar Migraciones (Desarrollo)
```bash
npm run migrate:dev
```

### 3. Cargar Datos de Madrid
```bash
npm run load-madrid-data
```

### 4. Verificar con Studio (Opcional)
```bash
npm run db:studio
```

## 🔧 Comandos Existentes Relacionados

### `npm run db:push`
- **Función**: Sincroniza el schema sin crear migración
- **Uso**: Para prototipado rápido
- **⚠️ Nota**: No recomendado para producción

### `npm run load-madrid-data`
- **Función**: Carga los datos del Ayuntamiento de Madrid
- **Uso**: Poblar la base de datos con direcciones de Madrid
- **Prerequisito**: Migraciones aplicadas

## 🚨 Comandos de Emergencia

### Resetear Todo (Desarrollo)
```bash
npm run migrate:reset --force
npm run load-madrid-data
```

### Verificar Integridad
```bash
npm run migrate:status
npm run migrate:diff
```

## 📊 Ejemplos de Uso

### Nuevo Desarrollador
```bash
# 1. Clonar repositorio
git clone <repo>
cd DEA_Analizer

# 2. Instalar dependencias
npm install

# 3. Verificar migraciones
npm run migrate:status

# 4. Aplicar migraciones
npm run migrate:dev

# 5. Cargar datos
npm run load-madrid-data

# 6. Verificar
npm run db:studio
```

### Después de Pull con Nuevas Migraciones
```bash
# 1. Verificar estado
npm run migrate:status

# 2. Aplicar nuevas migraciones
npm run migrate:dev

# 3. Regenerar cliente (si es necesario)
npm run db:generate
```

### Antes de Despliegue
```bash
# 1. Verificar diferencias
npm run migrate:diff

# 2. Formatear schema
npm run db:format

# 3. En producción
npm run migrate:deploy
```

## 🎯 Notas Importantes

- **migrate:dev** es para desarrollo (interactivo)
- **migrate:deploy** es para producción (no interactivo)
- **migrate:reset** elimina TODOS los datos
- **db:push** no crea archivos de migración
- Siempre hacer backup antes de **migrate:reset**

## 🔗 Enlaces Útiles

- [Documentación Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma Studio](https://www.prisma.io/docs/concepts/components/prisma-studio)
- [Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
