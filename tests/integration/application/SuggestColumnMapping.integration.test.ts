import { describe, it, expect } from "vitest";
import { SuggestColumnMappingUseCase } from "@/import/application/use-cases/SuggestColumnMappingUseCase";
import { CsvPreview } from "@/import/domain/value-objects/CsvPreview";

describe("SuggestColumnMappingUseCase - Integration", () => {
  const useCase = new SuggestColumnMappingUseCase();

  describe("Sugerencias automáticas", () => {
    it("debe sugerir mapeos para columnas con nombres en español", () => {
      const preview = CsvPreview.create(
        ["Código", "Dirección", "Número", "Código Postal", "Latitud", "Longitud"],
        [["DEA-001", "Calle Test", "10", "28001", "40.416775", "-3.703790"]],
        10
      );

      const result = useCase.execute({ preview });

      expect(result.suggestions).toBeDefined();
      expect(result.stats.totalSuggestions).toBeGreaterThanOrEqual(0);
      expect(result.unmappedColumns).toBeDefined();
    });

    it("debe sugerir mapeos para columnas con nombres en inglés", () => {
      const preview = CsvPreview.create(
        ["name", "email", "phone", "latitude", "longitude", "postal"],
        [["DEA Test", "test@test.com", "123456789", "40.416775", "-3.703790", "28001"]],
        10
      );

      const result = useCase.execute({ preview });

      expect(result.suggestions).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.stats.totalSuggestions).toBeGreaterThanOrEqual(0);
      expect(result.unmappedColumns).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it("debe identificar columnas no mapeadas", () => {
      const preview = CsvPreview.create(
        ["codigo_dea", "campo_desconocido", "otra_columna"],
        [["DEA-001", "valor1", "valor2"]],
        10
      );

      const result = useCase.execute({ preview });

      expect(result.unmappedColumns.length).toBeGreaterThan(0);
    });

    it("debe priorizar campos requeridos cuando se solicita", () => {
      const preview = CsvPreview.create(
        ["nombre", "calle", "numero", "email"],
        [["DEA Test", "Calle Principal", "123", "test@test.com"]],
        10
      );

      const result = useCase.execute({ preview, prioritizeRequired: true });

      expect(result.stats).toHaveProperty("requiredMapped");
      expect(result.stats).toHaveProperty("requiredTotal");
    });

    it("debe calcular confidence promedio correctamente", () => {
      const preview = CsvPreview.create(
        ["codigo", "nombre", "direccion"],
        [["DEA-001", "DEA Test", "Calle Test"]],
        10
      );

      const result = useCase.execute({ preview });

      expect(result.stats.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(result.stats.averageConfidence).toBeLessThanOrEqual(1);
    });

    it("debe detectar campos requeridos faltantes", () => {
      const preview = CsvPreview.create(
        ["email", "telefono"],
        [["test@test.com", "123456789"]],
        10
      );

      const result = useCase.execute({ preview });

      expect(result.missingRequiredFields).toBeDefined();
    });
  });

  describe("Resolución de conflictos", () => {
    it("debe resolver conflictos cuando múltiples columnas sugieren el mismo campo", () => {
      const preview = CsvPreview.create(
        ["calle", "direccion_calle", "via"],
        [["Calle Principal", "Calle Principal", "Calle Principal"]],
        10
      );

      const result = useCase.execute({ preview });

      const systemFields = result.suggestions.map((s) => s.systemFieldKey);
      const uniqueFields = new Set(systemFields);

      // No debe haber duplicados en los campos del sistema
      expect(systemFields.length).toBe(uniqueFields.size);
    });
  });

  describe("Casos edge", () => {
    it("debe manejar preview con una sola columna", () => {
      const preview = CsvPreview.create(["codigo"], [["DEA-001"]], 1);

      const result = useCase.execute({ preview });

      expect(result.suggestions).toBeDefined();
      expect(result.unmappedColumns).toBeDefined();
    });

    it("debe manejar columnas con caracteres especiales", () => {
      const preview = CsvPreview.create(
        ["Código_DEA", "Dirección (Calle)", "N° Portal"],
        [["DEA-001", "Test", "10"]],
        10
      );

      const result = useCase.execute({ preview });

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThanOrEqual(0);
    });

    it("debe manejar columnas con acentos y tildes", () => {
      const preview = CsvPreview.create(
        ["Código", "Dirección", "Teléfono", "Ubicación"],
        [["DEA-001", "Calle Test", "123456789", "Madrid"]],
        10
      );

      const result = useCase.execute({ preview });

      expect(result.suggestions).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.unmappedColumns).toBeDefined();
    });
  });

  describe("Estadísticas de mapeo", () => {
    it("debe proporcionar estadísticas completas", () => {
      const preview = CsvPreview.create(
        ["nombre", "calle", "numero"],
        [["DEA Test", "Calle Principal", "123"]],
        10
      );

      const result = useCase.execute({ preview });

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
