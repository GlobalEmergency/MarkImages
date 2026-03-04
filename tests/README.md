# Suite de Testing

Esta aplicación cuenta con una suite de tests completa que incluye tests unitarios, de integración y end-to-end.

## Estructura de Carpetas

```
tests/
├── unit/                      # Tests unitarios (104 tests)
│   ├── domain/
│   │   ├── entities/         # Tests de entidades
│   │   └── value-objects/    # Tests de value objects
│   └── ...
├── integration/               # Tests de integración (11 tests)
│   └── application/          # Tests de casos de uso
├── e2e/                      # Tests end-to-end con Playwright (60+ tests)
│   ├── home.spec.ts          # Tests de página principal
│   ├── navigation.spec.ts    # Tests de navegación
│   ├── search-and-filter.spec.ts  # Tests de búsqueda y filtros
│   ├── performance.spec.ts   # Tests de performance y SEO
│   └── user-interactions.spec.ts  # Tests de interacciones de usuario
└── setup.ts                  # Configuración global de tests
```

## Tecnologías Utilizadas

- **Vitest**: Framework de testing para tests unitarios e integración
- **@testing-library/react**: Utilidades para testing de componentes React
- **Playwright**: Framework para tests end-to-end

## Comandos Disponibles

### Tests Unitarios

```bash
# Ejecutar todos los tests unitarios
npm run test:unit

# Ejecutar tests en modo watch
npm run test:watch

# Ver interfaz web de Vitest
npm run test:ui
```

### Tests de Integración

```bash
# Ejecutar todos los tests de integración
npm run test:integration
```

### Tests End-to-End

Los tests E2E verifican flujos completos de usuario en la aplicación real.

**Archivos de test:**

- `home.spec.ts` - Página principal, elementos básicos, responsive design
- `navigation.spec.ts` - Navegación entre páginas, accesibilidad
- `search-and-filter.spec.ts` - Búsqueda, filtros, paginación, responsive
- `performance.spec.ts` - Performance, carga, optimizaciones, SEO
- `user-interactions.spec.ts` - Interacciones de usuario, accesibilidad

```bash
# Ejecutar todos los tests E2E
npm run test:e2e

# Ejecutar con interfaz visual (recomendado para desarrollo)
npm run test:e2e:ui

# Ejecutar con navegador visible (útil para debugging)
npm run test:e2e:headed

# Ejecutar un archivo específico
npx playwright test tests/e2e/home.spec.ts

# Ejecutar en modo debug
npx playwright test --debug
```

**Cobertura de tests E2E (60+ tests):**

- ✅ Página principal y header
- ✅ Navegación entre vistas (Lista/Mapa)
- ✅ Búsqueda y filtrado en tiempo real
- ✅ Paginación de resultados
- ✅ Responsive design (móvil, tablet, desktop)
- ✅ Accesibilidad y navegación por teclado
- ✅ Performance y tiempo de carga
- ✅ Manejo de errores
- ✅ SEO y meta tags
- ✅ Interacciones de usuario
- ✅ Estados de carga

### Ejecutar Todos los Tests

```bash
# Ejecutar tests unitarios e integración
npm run test:all

# Ejecutar tests con coverage
npm run test:coverage
```

## Escribir Tests

### Tests Unitarios

Los tests unitarios deben estar en `tests/unit/` y seguir la estructura del código fuente:

```typescript
import { describe, it, expect } from "vitest";
import { MiClase } from "@/domain/...";

describe("MiClase", () => {
  it("debe hacer algo específico", () => {
    // Arrange
    const instancia = new MiClase();

    // Act
    const resultado = instancia.metodo();

    // Assert
    expect(resultado).toBe(valorEsperado);
  });
});
```

### Tests de Integración

Los tests de integración deben estar en `tests/integration/` y probar la interacción entre múltiples componentes:

```typescript
import { describe, it, expect } from "vitest";
import { MiUseCase } from "@/application/...";

describe("MiUseCase - Integration", () => {
  it("debe ejecutar el flujo completo", async () => {
    // Arrange
    const useCase = new MiUseCase();

    // Act
    const resultado = await useCase.execute(request);

    // Assert
    expect(resultado).toBeDefined();
  });
});
```

### Tests E2E

Los tests E2E deben estar en `tests/e2e/` y probar flujos completos de usuario:

```typescript
import { test, expect } from "@playwright/test";

test("flujo de usuario", async ({ page }) => {
  await page.goto("/");

  // Interactuar con la página
  await page.click("button");

  // Verificar resultados
  await expect(page.locator("h1")).toContainText("Título esperado");
});
```

## Cobertura de Código

Para generar un reporte de cobertura:

```bash
npm run test:coverage
```

El reporte HTML se generará en `coverage/index.html`.

## CI/CD

Los tests se ejecutan automáticamente en cada push. Asegúrate de que todos los tests pasen antes de hacer merge.

## Mejores Prácticas

1. **AAA Pattern**: Organiza tus tests en Arrange, Act, Assert
2. **Tests independientes**: Cada test debe poder ejecutarse de forma independiente
3. **Nombres descriptivos**: Usa nombres que describan claramente qué se está probando
4. **Un assert por test**: Enfócate en probar una cosa a la vez
5. **Mock cuando sea necesario**: Usa mocks para aislar la unidad bajo test
