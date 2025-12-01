# Git Hooks Configuration

Este proyecto usa [Husky](https://typicode.github.io/husky/) para ejecutar validaciones automáticas antes de commits y pushes.

## Instalación

Los hooks se instalan automáticamente cuando ejecutas:

```bash
npm install
```

El script `prepare` en `package.json` ejecuta `husky` que configura todo automáticamente.

## Hooks Configurados

### `pre-commit`

Ejecuta **lint-staged** que analiza solo los archivos modificados:

- ✅ `eslint --fix` - Corrige errores de linting automáticamente
- ✅ `prettier --write` - Formatea el código

**Archivos analizados:**
- `*.{js,jsx,ts,tsx}` - ESLint + Prettier
- `*.{json,md,yml,yaml}` - Prettier
- `*.{css,scss}` - Prettier

### `pre-push`

Ejecuta validación completa del proyecto antes de permitir el push:

1. ✅ **Type checking** - `npm run type-check` - Verifica tipos de TypeScript
2. ✅ **Linting** - `npm run lint` - Verifica todo el código con ESLint
3. ✅ **Build** - `npm run build` - Compila el proyecto completo

Si **cualquiera** de estas validaciones falla, el push será bloqueado.

## Comandos Útiles

```bash
# Validar manualmente todo el proyecto
npm run validate

# Ejecutar solo el type check
npm run type-check

# Ejecutar solo el lint
npm run lint

# Ejecutar solo el build
npm run build

# Saltar hooks (⚠️ úsalo solo si sabes lo que haces)
git commit --no-verify
git push --no-verify
```

## Troubleshooting

Si los hooks no se ejecutan:

1. Verifica que hayas ejecutado `npm install`
2. Verifica que los hooks tengan permisos de ejecución: `ls -la .husky/`
3. Verifica la configuración de Git: `git config --get core.hooksPath` (debería ser `.husky`)
