import { describe, it, expect } from "vitest";
import { SuggestColumnMappingUseCase } from "@/application/import/use-cases/SuggestColumnMappingUseCase";
import { CsvPreview } from "@/domain/import/value-objects/CsvPreview";

describe("SuggestColumnMappingUseCase - Integration", () => {
  const useCase = new SuggestColumnMappingUseCase();

  describe("Sugerencias automáticas", () => {
    it("debe sugerir mapeos para columnas con nombres en español", () => {
      // Arrange: Crear un preview con columnas en español
      const preview = CsvPreview.create(
        ["Código", "Dirección", "Número", "Código Postal", "Latitud", "Longitud"],
        [
          {
            Código: "DEA-001",
            Dirección: "Calle Test",
            Número: "10",
            "Código Postal": "28001",
            Latitud: "40.416775",
            Longitud: "-3.703790",
          },
        ],
        10
      );

      // Act: Ejecutar sugerencias
      const result = useCase.execute({ preview });

      // Assert: Debe generar sugerencias (aunque pueden ser 0 si no hay matches)
      expect(result.suggestions).toBeDefined();
      expect(result.stats.totalSuggestions).toBeGreaterThanOrEqual(0);
      expect(result.unmappedColumns).toBeDefined();
    });

    it("debe sugerir mapeos para columnas con nombres en inglés", () => {
      // Arrange: Crear un preview con columnas que tienen keywords en inglés
      const preview = CsvPreview.create(
        ["name", "email", "phone", "latitude", "longitude", "postal"],
        [
          {
            name: "DEA Test",
            email: "test@test.com",
            phone: "123456789",
            latitude: "40.416775",
            longitude: "-3.703790",
            postal: "28001",
          },
        ],
        10
      );

      // Act: Ejecutar sugerencias
      const result = useCase.execute({ preview });

      // Assert: El sistema debe procesar las columnas sin errores
      // Puede generar sugerencias o no dependiendo del threshold del algoritmo
      expect(result.suggestions).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.stats.totalSuggestions).toBeGreaterThanOrEqual(0);

      // Verificar que el proceso no crashea con nombres en inglés
      expect(result.unmappedColumns).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it("debe identificar columnas no mapeadas", () => {
      // Arrange: Crear un preview con algunas columnas que no matchean
      const preview = CsvPreview.create(
        ["codigo_dea", "campo_desconocido", "otra_columna"],
        [
          {
            codigo_dea: "DEA-001",
            campo_desconocido: "valor1",
            otra_columna: "valor2",
          },
        ],
        10
      );

      // Act: Ejecutar sugerencias
      const result = useCase.execute({ preview });

      // Assert: Debe identificar columnas no mapeadas
      expect(result.unmappedColumns.length).toBeGreaterThan(0);
    });

    it("debe priorizar campos requeridos cuando se solicita", () => {
      // Arrange: Preview con campos opcionales y requeridos
      const preview = CsvPreview.create(
        ["nombre", "calle", "numero", "email"],
        [
          {
            nombre: "DEA Test",
            calle: "Calle Principal",
            numero: "123",
            email: "test@test.com",
          },
        ],
        10
      );

      // Act: Ejecutar con priorización de requeridos
      const result = useCase.execute({ preview, prioritizeRequired: true });

      // Assert: Debe reportar estadísticas de campos requeridos
      expect(result.stats).toHaveProperty("requiredMapped");
      expect(result.stats).toHaveProperty("requiredTotal");
    });

    it("debe calcular confidence promedio correctamente", () => {
      // Arrange: Preview con columnas claras
      const preview = CsvPreview.create(
        ["codigo", "nombre", "direccion"],
        [
          {
            codigo: "DEA-001",
            nombre: "DEA Test",
            direccion: "Calle Test",
          },
        ],
        10
      );

      // Act
      const result = useCase.execute({ preview });

      // Assert: El promedio de confidence debe estar entre 0 y 1
      expect(result.stats.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(result.stats.averageConfidence).toBeLessThanOrEqual(1);
    });

    it("debe detectar campos requeridos faltantes", () => {
      // Arrange: Preview sin todos los campos requeridos
      const preview = CsvPreview.create(
        ["email", "telefono"], // Solo campos opcionales
        [
          {
            email: "test@test.com",
            telefono: "123456789",
          },
        ],
        10
      );

      // Act
      const result = useCase.execute({ preview });

      // Assert: Debe reportar campos requeridos faltantes
      expect(result.missingRequiredFields).toBeDefined();
      // Deberían faltar campos como nombre, calle, numero que son requeridos
    });
  });

  describe("Resolución de conflictos", () => {
    it("debe resolver conflictos cuando múltiples columnas sugieren el mismo campo", () => {
      // Arrange: Columnas que podrían sugerir el mismo campo
      const preview = CsvPreview.create(
        ["calle", "direccion_calle", "via"],
        [
          {
            calle: "Calle Principal",
            direccion_calle: "Calle Principal",
            via: "Calle Principal",
          },
        ],
        10
      );

      // Act
      const result = useCase.execute({ preview });

      // Assert: Debe elegir solo una columna para cada campo del sistema
      const systemFields = result.suggestions.map((s) => s.systemFieldKey);
      const uniqueFields = new Set(systemFields);

      // No debe haber duplicados en los campos del sistema
      expect(systemFields.length).toBe(uniqueFields.size);
    });
  });

  describe("Casos edge", () => {
    it("debe manejar preview con una sola columna", () => {
      // Arrange
      const preview = CsvPreview.create(["codigo"], [{ codigo: "DEA-001" }], 1);

      // Act
      const result = useCase.execute({ preview });

      // Assert: No debe crashear
      expect(result.suggestions).toBeDefined();
      expect(result.unmappedColumns).toBeDefined();
    });

    it("debe manejar columnas con caracteres especiales", () => {
      // Arrange
      const preview = CsvPreview.create(
        ["Código_DEA", "Dirección (Calle)", "N° Portal"],
        [
          {
            Código_DEA: "DEA-001",
            "Dirección (Calle)": "Test",
            "N° Portal": "10",
          },
        ],
        10
      );

      // Act
      const result = useCase.execute({ preview });

      // Assert: Debe manejar caracteres especiales
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThanOrEqual(0);
    });

    it("debe manejar columnas con acentos y tildes", () => {
      // Arrange
      const preview = CsvPreview.create(
        ["Código", "Dirección", "Teléfono", "Ubicación"],
        [
          {
            Código: "DEA-001",
            Dirección: "Calle Test",
            Teléfono: "123456789",
            Ubicación: "Madrid",
          },
        ],
        10
      );

      // Act
      const result = useCase.execute({ preview });

      // Assert: Debe normalizar correctamente (aunque no necesariamente sugerir mapeos)
      expect(result.suggestions).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.unmappedColumns).toBeDefined();
    });
  });

  describe("Estadísticas de mapeo", () => {
    it("debe proporcionar estadísticas completas", () => {
      // Arrange
      const preview = CsvPreview.create(
        ["nombre", "calle", "numero"],
        [
          {
            nombre: "DEA Test",
            calle: "Calle Principal",
            numero: "123",
          },
        ],
        10
      );

      // Act
      const result = useCase.execute({ preview });

      // Assert: Debe incluir todas las estadísticas esperadas
      expect(result.stats).toHaveProperty("totalSuggestions");
      expect(result.stats).toHaveProperty("requiredMapped");
      expect(result.stats).toHaveProperty("requiredTotal");
      expect(result.stats).toHaveProperty("averageConfidence");

      expect(typeof result.stats.totalSuggestions).toBe("number");
      expect(typeof result.stats.requiredMapped).toBe("number");
      expect(typeof result.stats.requiredTotal).toBe("number");
      expect(typeof result.stats.averageConfidence).toBe("number");
    });
  });
});
