# DEA Analizer - Sistema de Análisis de Desfibriladores Externos Automáticos

Sistema web para el análisis y validación de ubicaciones de Desfibriladores Externos Automáticos (DEA) en Madrid, desarrollado con Next.js y PostgreSQL.

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js 22 
- PostgreSQL
- Variables de entorno configuradas (`.env.local`)

### Instalación

```bash
# Clonar el repositorio
git clone <repository-url>
cd DEA_Analizer

# Instalar dependencias
npm install

# Verificar estado de migraciones
npm run migrate:status

# Aplicar migraciones (si es necesario)
npm run migrate:dev

# Cargar datos de Madrid
npm run load-madrid-data

# Iniciar servidor de desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) para ver la aplicación.

## 📚 Documentación

Toda la documentación del proyecto se encuentra en la carpeta [`doc/`](./doc/):

- **[Índice de Documentación](./doc/README.md)** - Punto de entrada a toda la documentación
- **[Comandos de Migración](./doc/MIGRATION_COMMANDS.md)** - Gestión de base de datos
- **[Validación de Direcciones](./doc/README_VALIDATION.md)** - Sistema de validación
- **[Resolución de Problemas](./doc/DEPLOYMENT_TROUBLESHOOTING.md)** - Guía de troubleshooting

## 🛠️ Comandos Principales

### Desarrollo
```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run start        # Servidor de producción
```

### Base de Datos
```bash
npm run migrate:status    # Verificar estado de migraciones
npm run migrate:dev      # Aplicar migraciones en desarrollo
npm run db:studio        # Abrir Prisma Studio
npm run load-madrid-data # Cargar datos de Madrid
```

### Testing
```bash
npm run test            # Ejecutar tests
npm run test:validation # Tests de validación específicos
```

## 🏗️ Arquitectura

### Stack Tecnológico
- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend**: Next.js API Routes
- **Base de Datos**: PostgreSQL con Prisma ORM
- **Estilos**: Tailwind CSS
- **Despliegue**: Vercel

### Estructura del Proyecto
```
DEA_Analizer/
├── src/
│   ├── app/           # App Router de Next.js
│   ├── components/    # Componentes React
│   ├── services/      # Lógica de negocio
│   ├── types/         # Definiciones TypeScript
│   └── utils/         # Utilidades
├── prisma/            # Schema y migraciones
├── scripts/           # Scripts de carga de datos
├── doc/              # Documentación del proyecto
└── tests/            # Tests automatizados
```

## 📊 Base de Datos

### Datos Cargados
- **21 distritos** de Madrid
- **131 barrios**
- **9,393 vías** (calles, avenidas, plazas)
- **213,427 direcciones** con coordenadas geográficas

### Optimizaciones
- Índices espaciales para búsquedas geográficas
- Índices de texto completo en español
- Índices compuestos para consultas complejas

## 🔧 Configuración

### Variables de Entorno
Crear archivo `.env.local`:
```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
# Otras variables según necesidad
```

### Base de Datos
El proyecto utiliza una migración consolidada optimizada. Ver [documentación de migraciones](./doc/MIGRATION_COMMANDS.md) para más detalles.

## 🚀 Despliegue

### Vercel (Recomendado)
1. Conectar repositorio a Vercel
2. Configurar variables de entorno
3. El despliegue es automático

Ver [guía de troubleshooting](./doc/DEPLOYMENT_TROUBLESHOOTING.md) para problemas comunes.

## 🤝 Contribución

1. Fork del proyecto
2. Crear rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.

## 🆘 Soporte

- **Documentación**: [./doc/README.md](./doc/README.md)
- **Issues**: Usar el sistema de issues de GitHub
- **Troubleshooting**: [./doc/DEPLOYMENT_TROUBLESHOOTING.md](./doc/DEPLOYMENT_TROUBLESHOOTING.md)

---

**Desarrollado para el análisis y optimización de ubicaciones de DEA en Madrid**
