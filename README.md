# DEA Madrid - Desfibriladores Automáticos Externos

Aplicación para gestionar y visualizar la ubicación de desfibriladores (DEAs) en Madrid.

## 🚀 Deployment en Vercel

### Auto-Deploy Configurado

El proyecto está configurado para hacer auto-deploy de migraciones **solo en Vercel** y **solo en ramas específicas**.

**Comando de build**: `node scripts/migrate.js && next build`

#### Comportamiento Inteligente

El script `scripts/migrate.js` verifica automáticamente:
- ✅ **Entorno Vercel**: Solo ejecuta migraciones si `VERCEL=1`
- ✅ **Ramas permitidas**: Solo en ramas `main` o `refactor` (o que contengan estos nombres)
- ✅ **Prisma Client**: Siempre se genera, independientemente de la rama

Esto ejecutará automáticamente:
1. Las migraciones de base de datos (solo si estás en Vercel + rama correcta)
2. La generación del cliente de Prisma (siempre)
3. El build de Next.js

### Variables de Entorno Requeridas

En Vercel, configura la siguiente variable:

```env
DATABASE_URL="postgresql://user:password@host:port/database"
```

### Primer Deploy

1. **Conecta el repositorio** a Vercel
2. **Configura la variable** `DATABASE_URL`
3. **Deploy**: Vercel ejecutará las migraciones automáticamente
4. **Seeds** (opcional): Ejecuta manualmente si quieres datos de ejemplo:
   ```bash
   npm run db:seed
   ```

## 📋 Desarrollo Local

### Requisitos

- Node.js 18+
- PostgreSQL con extensión PostGIS
- npm o yarn

### Setup

1. **Clonar el repositorio**
   ```bash
   git clone <repo-url>
   cd MarkImages
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   # Editar .env con tu DATABASE_URL
   ```

4. **Ejecutar migraciones** (para desarrollo local)
   ```bash
   npx prisma migrate deploy  # O usa: npx prisma migrate dev
   npx prisma generate
   ```

   **Nota**: `npm run build` NO ejecuta migraciones en local (solo en Vercel)

5. **Seed (opcional)**
   ```bash
   npm run db:seed
   ```

6. **Iniciar desarrollo**
   ```bash
   npm run dev
   ```

## 📚 Estructura del Proyecto

```
src/
├── app/
│   ├── page.tsx              # Página principal (lista de AEDs)
│   └── api/
│       └── aeds/
│           └── route.ts      # API REST para AEDs
├── hooks/
│   └── useAeds.ts            # Hook para obtener AEDs
├── types/
│   ├── aed.ts                # Tipos de AED
│   └── index.ts              # Re-exports
prisma/
├── schema.prisma             # Esquema de base de datos
├── seed.ts                   # Seeds de ejemplo
└── migrations/
    └── 20250126000000_init/  # Migración inicial
```

## 🗄️ Base de Datos

### Schema Principal

- **Aed**: Desfibriladores con toda su información
- **AedLocation**: Ubicación detallada
- **AedResponsible**: Responsable/contacto
- **AedSchedule**: Horarios de disponibilidad
- **District, Neighborhood, Street**: Sistema de direcciones oficial

### Migraciones

Las migraciones se ejecutan automáticamente **solo en Vercel** en ramas `main` y `refactor`.

Para desarrollo local:

```bash
# Ver estado
npx prisma migrate status

# Aplicar migraciones
npx prisma migrate deploy

# Crear nueva migración
npx prisma migrate dev --name descripcion_cambio

# Reset completo (CUIDADO: elimina todos los datos)
npx prisma migrate reset
```

## 🎯 Features

### Implementado
- ✅ Lista de AEDs publicados
- ✅ Búsqueda por nombre/código
- ✅ Paginación
- ✅ Auto-deploy condicional de migraciones (Vercel + ramas específicas)
- ✅ Schema normalizado con PostGIS

### Por Implementar
- [ ] Mapa interactivo
- [ ] Detalle de AED
- [ ] Formulario de registro
- [ ] Panel de administración
- [ ] Sistema de validación

## 📖 API

### GET /api/aeds

Lista AEDs publicados con paginación.

**Query params:**
- `page` (default: 1)
- `limit` (default: 50, max: 100)
- `search` (opcional): buscar por nombre o código

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

## 🛠️ Scripts Disponibles

```bash
npm run dev          # Desarrollo con Turbopack
npm run build        # Build + migraciones
npm start            # Producción
npm run db:seed      # Ejecutar seeds
npm run db:studio    # Abrir Prisma Studio
```

## 📝 Notas

- El proyecto usa **Next.js 15** con App Router
- La base de datos requiere **PostgreSQL** con extensión **PostGIS**
- Las migraciones se ejecutan automáticamente solo en Vercel en ramas `main` y `refactor`
- Para desarrollo local, ejecuta las migraciones manualmente con `npx prisma migrate deploy`
- Solo se muestran AEDs con status `PUBLISHED`

## 🔗 Links

- [Documentación de Prisma](https://www.prisma.io/docs)
- [Next.js 15 Docs](https://nextjs.org/docs)
- [Vercel Deployment](https://vercel.com/docs)
