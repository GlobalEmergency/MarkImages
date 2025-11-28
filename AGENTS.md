# Development Guidelines for Agents

Este documento establece las directrices de desarrollo que deben seguir todos los agentes de IA (incluyendo Claude Code) al trabajar en este proyecto.

## Principios Fundamentales

### 1. SOLID Principles & Clean Code

Aplicar rigurosamente los principios SOLID en todo el código:

- **Single Responsibility Principle (SRP)**: Cada clase/función debe tener una única responsabilidad
- **Open/Closed Principle (OCP)**: Abierto para extensión, cerrado para modificación
- **Liskov Substitution Principle (LSP)**: Las subclases deben ser sustituibles por sus clases base
- **Interface Segregation Principle (ISP)**: Interfaces específicas mejor que una interfaz general
- **Dependency Inversion Principle (DIP)**: Depender de abstracciones, no de implementaciones concretas

**Clean Code:**
- Funciones pequeñas con un propósito claro
- Nombres descriptivos y significativos
- Evitar código duplicado (DRY)
- Minimizar la complejidad ciclomática
- Preferir composición sobre herencia

### 2. Domain-Driven Design (DDD)

Estructura del proyecto siguiendo DDD:

```
src/
├── domain/           # Entidades, Value Objects, Domain Events
│   ├── entities/
│   ├── value-objects/
│   ├── events/
│   └── errors/
├── application/      # Use Cases, DTOs, Interfaces
│   ├── use-cases/
│   └── dtos/
├── infrastructure/   # Implementaciones concretas
│   ├── repositories/
│   ├── services/
│   └── adapters/
└── interfaces/       # Controllers, API Routes, UI
    ├── api/
    └── components/
```

**Reglas DDD:**
- Las entidades de dominio no deben tener dependencias externas
- Los Value Objects son inmutables
- Usar eventos de dominio para comunicación entre agregados
- Los repositorios solo existen en la capa de dominio (interfaces) y se implementan en infraestructura
- Usar Domain Errors específicos del negocio

### 3. Outside-In Development (Out to IN)

Desarrollar siempre de fuera hacia dentro:

1. **Interfaces primero**: Definir contratos y APIs públicas
2. **Tests de aceptación**: Escribir tests desde la perspectiva del usuario
3. **Implementación exterior**: Controllers, API routes, componentes
4. **Lógica de aplicación**: Use cases y servicios de aplicación
5. **Dominio**: Entidades y reglas de negocio
6. **Infraestructura**: Implementaciones concretas (DB, APIs externas)

**Ejemplo de flujo:**
```typescript
// 1. Primero: Definir la interfaz pública (API Route)
// 2. Segundo: Test de integración
// 3. Tercero: Use case
// 4. Cuarto: Dominio
// 5. Quinto: Implementación del repositorio
```

### 4. Testing con Mocks

**Reglas de testing:**
- Cada use case debe tener su test unitario
- Usar mocks para todas las dependencias externas
- Tests deben ser independientes y repetibles
- Seguir el patrón AAA (Arrange, Act, Assert)
- Nombrar tests descriptivamente: `should[ExpectedBehavior]When[Condition]`

**Ejemplo:**
```typescript
describe('ValidateAddressUseCase', () => {
  it('shouldReturnValidWhenAddressExistsInDatabase', async () => {
    // Arrange
    const mockRepository = {
      findByAddress: jest.fn().mockResolvedValue(mockAddress)
    };
    const useCase = new ValidateAddressUseCase(mockRepository);

    // Act
    const result = await useCase.execute({ address: 'Calle Mayor 1' });

    // Assert
    expect(result.isValid).toBe(true);
  });
});
```

### 5. Código Autodocumentado

**Minimizar comentarios**, el código debe ser la documentación:

❌ **Evitar:**
```typescript
// Valida la dirección
function v(d: string) { ... }
```

✅ **Preferir:**
```typescript
function validateAddress(address: string): ValidationResult {
  const normalizedAddress = normalizeStreetAddress(address);
  return performValidation(normalizedAddress);
}
```

**Cuando usar comentarios:**
- Explicar decisiones de negocio complejas
- Documentar limitaciones de APIs externas
- Explicar workarounds temporales (con ticket de referencia)
- JSDoc para APIs públicas

### 6. Frontend: Mobile First & Latest Technologies

**Principios Frontend:**

1. **Mobile First**: Diseñar primero para móvil, luego desktop
```typescript
// Tailwind CSS - Mobile first
<div className="w-full md:w-1/2 lg:w-1/3">
```

2. **Tecnologías actuales del proyecto:**
   - Next.js 15 (App Router)
   - React 19
   - TypeScript 5.8
   - Tailwind CSS 3.4
   - Server Components por defecto

3. **Buenas prácticas:**
   - Usar Server Components cuando sea posible
   - Client Components solo cuando necesario (`'use client'`)
   - Optimización de imágenes con `next/image`
   - Lazy loading para componentes pesados
   - Suspense boundaries para mejor UX

4. **Responsive Design:**
```typescript
// Breakpoints de Tailwind
sm: '640px'   // Mobile landscape
md: '768px'   // Tablet
lg: '1024px'  // Desktop
xl: '1280px'  // Large desktop
```

## Checklist de Desarrollo

Antes de completar cualquier tarea, verificar:

### Validación de Código (Obligatorio)
- [ ] **Ejecutar `npm run lint:fix`** - El código debe pasar sin errores críticos
- [ ] **Ejecutar `npm run build`** - El build debe completarse sin errores críticos

### Calidad de Código
- [ ] ¿El código sigue los principios SOLID?
- [ ] ¿La arquitectura respeta las capas de DDD?
- [ ] ¿He desarrollado Outside-In?
- [ ] ¿Los tests cubren los casos importantes con mocks?
- [ ] ¿El código es autodocumentado sin comentarios innecesarios?
- [ ] ¿El frontend es mobile-first?
- [ ] ¿He usado las últimas características de Next.js 15 y React 19?
- [ ] ¿Las variables y funciones tienen nombres claros y descriptivos?
- [ ] ¿He evitado código duplicado?
- [ ] ¿Las funciones son pequeñas y tienen una única responsabilidad?

**⚠️ IMPORTANTE**: No se puede completar ninguna tarea sin que `npm run lint:fix` y `npm run build` se ejecuten exitosamente sin errores críticos. Estos comandos deben ejecutarse antes de hacer commit o dar por finalizada cualquier implementación.

## Estructura de Commits

Usar conventional commits:

```
feat: añadir validación de direcciones con DDD
fix: corregir error en normalización de calles
refactor: extraer lógica de dominio a value objects
test: añadir tests unitarios para AddressValidator
docs: actualizar guías de desarrollo
```

## Ejemplo Completo

```typescript
// Domain Layer - Value Object
export class Address {
  private constructor(
    private readonly street: string,
    private readonly number: string,
    private readonly neighborhood: string
  ) {}

  static create(data: AddressData): Either<DomainError, Address> {
    if (!this.isValidStreet(data.street)) {
      return Left(new InvalidAddressError('Invalid street'));
    }
    return Right(new Address(data.street, data.number, data.neighborhood));
  }

  get value(): string {
    return `${this.street} ${this.number}`;
  }
}

// Application Layer - Use Case
export class ValidateAddressUseCase {
  constructor(
    private readonly addressRepository: AddressRepository,
    private readonly validator: AddressValidator
  ) {}

  async execute(request: ValidateAddressRequest): Promise<ValidationResult> {
    const addressOrError = Address.create(request);
    if (addressOrError.isLeft()) {
      return ValidationResult.invalid(addressOrError.value);
    }

    const exists = await this.addressRepository.exists(addressOrError.value);
    return this.validator.validate(addressOrError.value, exists);
  }
}

// Infrastructure Layer - Repository Implementation
export class PrismaAddressRepository implements AddressRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async exists(address: Address): Promise<boolean> {
    const result = await this.prisma.address.findUnique({
      where: { value: address.value }
    });
    return result !== null;
  }
}

// Interface Layer - API Route (Next.js 15)
export async function POST(request: Request) {
  const body = await request.json();

  const useCase = new ValidateAddressUseCase(
    new PrismaAddressRepository(prisma),
    new DefaultAddressValidator()
  );

  const result = await useCase.execute(body);

  return Response.json(result);
}
```

---

**Nota**: Estas guías son obligatorias para mantener la calidad y consistencia del código en el proyecto.
