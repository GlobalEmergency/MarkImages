, # Detección de Duplicados - Arquitectura DDD y SOLID

## Descripción General

El sistema de detección de duplicados sigue una arquitectura hexagonal limpia con **inyección de dependencias**, respetando los principios **SOLID** y **DDD**.

---

## 🏗️ Capas de Arquitectura

### 1. **Dominio** (Reglas de negocio puras)

#### Puertos (Interfaces)
```
src/import/domain/ports/
├── ITextNormalizationService.ts      # Contrato de normalización
├── IDuplicateScoringService.ts       # Contrato de scoring
└── IDuplicateDetectionService.ts     # Contrato principal
```

**Ventajas:**
- ✅ Independiente de implementación
- ✅ Testable con mocks
- ✅ Cambiar implementación sin tocar dominio
- ✅ Cumple con Dependency Inversion Principle (DIP)

---

### 2. **Infraestructura** (Implementaciones concretas)

#### Servicios
```
src/import/infrastructure/services/
├── PostgreSqlTextNormalizer.ts       # Implementa ITextNormalizationService
└── PostgreSqlDuplicateScorer.ts      # Implementa IDuplicateScoringService
```

#### Adapters
```
src/import/infrastructure/adapters/
└── PrismaDuplicateDetectionAdapter.ts  # Orquestador con DI
```

---

## 💉 Inyección de Dependencias

### Instanciación del Adapter

```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaDuplicateDetectionAdapter } from "@/import/infrastructure/adapters/PrismaDuplicateDetectionAdapter";
import { PostgreSqlTextNormalizer } from "@/import/infrastructure/services/PostgreSqlTextNormalizer";

// 1. Crear servicios de dominio
const textNormalizer = new PostgreSqlTextNormalizer();

// 2. Inyectar dependencias en el adapter
const duplicateDetectionService = new PrismaDuplicateDetectionAdapter(
  prisma,
  textNormalizer
);

// 3. Usar el servicio
const result = await duplicateDetectionService.checkDuplicate({
  name: "Centro Deportivo Municipal",
  streetType: "Calle",
  streetName: "Mayor",
  streetNumber: "1",
  latitude: 40.4168,
  longitude: -3.7038,
});
```

---

## 🧪 Testing con Mocks

### Test Unitario del Adapter

```typescript
import { describe, it, expect, vi } from "vitest";
import { PrismaDuplicateDetectionAdapter } from "@/import/infrastructure/adapters/PrismaDuplicateDetectionAdapter";
import { ITextNormalizationService } from "@/import/domain/ports/ITextNormalizationService";

describe("PrismaDuplicateDetectionAdapter", () => {
  it("should use injected text normalizer", async () => {
    // Mock del servicio de normalización
    const mockNormalizer: ITextNormalizationService = {
      normalize: vi.fn((text) => text?.toLowerCase() || ""),
      normalizeAddress: vi.fn(() => "calle mayor 1"),
    };

    // Mock de Prisma
    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
    } as any;

    // Instanciar adapter con mocks
    const adapter = new PrismaDuplicateDetectionAdapter(
      mockPrisma,
      mockNormalizer
    );

    // Ejecutar
    await adapter.checkDuplicate({
      name: "Test",
      streetType: "Calle",
      streetName: "Mayor",
      streetNumber: "1",
    });

    // Verificar que se usó el servicio inyectado
    expect(mockNormalizer.normalize).toHaveBeenCalledWith("Test");
    expect(mockNormalizer.normalizeAddress).toHaveBeenCalled();
  });
});
```

### Test de Integración

```typescript
import { describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaDuplicateDetectionAdapter } from "@/import/infrastructure/adapters/PrismaDuplicateDetectionAdapter";
import { PostgreSqlTextNormalizer } from "@/import/infrastructure/services/PostgreSqlTextNormalizer";

describe("Duplicate Detection Integration", () => {
  it("should detect duplicates using real PostgreSQL", async () => {
    const prisma = new PrismaClient();
    const textNormalizer = new PostgreSqlTextNormalizer();
    
    const adapter = new PrismaDuplicateDetectionAdapter(
      prisma,
      textNormalizer
    );

    const result = await adapter.checkDuplicate({
      name: "Centro Deportivo",
      latitude: 40.4168,
      longitude: -3.7038,
    });

    expect(result).toBeDefined();
    expect(typeof result.isDuplicate).toBe("boolean");
    
    await prisma.$disconnect();
  });
});
```

---

## 🔄 Cambiar Implementación

### Ejemplo: Implementación en Memoria (para testing)

```typescript
// src/import/infrastructure/services/InMemoryTextNormalizer.ts
export class InMemoryTextNormalizer implements ITextNormalizationService {
  normalize(text: string | null | undefined): string {
    if (!text) return "";
    return text.toLowerCase().trim();
  }

  normalizeAddress(
    streetType: string | null | undefined,
    streetName: string | null | undefined,
    streetNumber: string | null | undefined
  ): string {
    return [streetType, streetName, streetNumber]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .trim();
  }
}
```

**Usar la nueva implementación:**
```typescript
// Solo cambiar la instanciación
const textNormalizer = new InMemoryTextNormalizer();

const adapter = new PrismaDuplicateDetectionAdapter(
  prisma,
  textNormalizer // Usa la nueva implementación
);
```

**Sin cambios en:**
- ❌ Dominio (interfaces)
- ❌ Adapter (código)
- ❌ Tests (solo mocks)

---

## 🎯 Principios SOLID Aplicados

### 1. **Single Responsibility Principle (SRP)**
- `PostgreSqlTextNormalizer`: Solo normaliza texto
- `PostgreSqlDuplicateScorer`: Solo calcula scores
- `PrismaDuplicateDetectionAdapter`: Solo orquesta la búsqueda

### 2. **Open/Closed Principle (OCP)**
- Puedes **extender** con nuevas implementaciones sin **modificar** el código existente

### 3. **Liskov Substitution Principle (LSP)**
- Cualquier implementación de `ITextNormalizationService` es intercambiable

### 4. **Interface Segregation Principle (ISP)**
- Interfaces pequeñas y específicas:
  - `ITextNormalizationService`: Solo normalización
  - `IDuplicateScoringService`: Solo scoring
  
### 5. **Dependency Inversion Principle (DIP)**
- El adapter **depende de abstracciones** (interfaces), no de implementaciones concretas

---

## 📁 Estructura Final

```
src/import/
├── domain/
│   ├── ports/                          # INTERFACES (contratos)
│   │   ├── ITextNormalizationService.ts
│   │   ├── IDuplicateScoringService.ts
│   │   └── IDuplicateDetectionService.ts
│   └── config/
│       └── DuplicateDetectionConfig.ts
│
└── infrastructure/
    ├── services/                       # IMPLEMENTACIONES
    │   ├── PostgreSqlTextNormalizer.ts
    │   └── PostgreSqlDuplicateScorer.ts
    └── adapters/                       # ORQUESTADORES
        └── PrismaDuplicateDetectionAdapter.ts
```

---

## 🚀 Factory Pattern (Opcional)

Para simplificar la instanciación:

```typescript
// src/import/infrastructure/factories/DuplicateDetectionFactory.ts
export class DuplicateDetectionFactory {
  static create(prisma: PrismaClient): IDuplicateDetectionService {
    const textNormalizer = new PostgreSqlTextNormalizer();
    
    return new PrismaDuplicateDetectionAdapter(
      prisma,
      textNormalizer
    );
  }

  static createWithCustomNormalizer(
    prisma: PrismaClient,
    normalizer: ITextNormalizationService
  ): IDuplicateDetectionService {
    return new PrismaDuplicateDetectionAdapter(
      prisma,
      normalizer
    );
  }
}

// Uso simplificado
const service = DuplicateDetectionFactory.create(prisma);
```

---

## 🔧 Ventajas de esta Arquitectura

1. **Testabilidad**: Fácil mockear dependencias
2. **Mantenibilidad**: Cambios localizados en una clase
3. **Extensibilidad**: Nuevas implementaciones sin tocar código existente
4. **Consistencia**: Misma lógica en tests y producción
5. **Performance**: PostgreSQL optimizado, JavaScript cuando necesario
6. **Flexibilidad**: Cambiar estrategia según contexto

---

## 📚 Referencias

- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [Dependency Injection](https://martinfowler.com/articles/injection.html)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)

---

**Versión:** 3.1.0 (DDD Compliant)  
**Fecha:** 21 de diciembre de 2025  
**Arquitectura:** Hexagonal + SOLID + DDD
