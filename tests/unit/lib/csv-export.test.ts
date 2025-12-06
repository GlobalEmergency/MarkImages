import { describe, it, expect } from "vitest";
import { aedsToCsv, generateExportFilename, createCsvBlob } from "@/lib/csv-export";

describe("csv-export", () => {
  describe("aedsToCsv", () => {
    it("should include db_id, dea_status, and duplicate columns in the CSV headers", () => {
      const aeds = [
        {
          id: "123e4567-e89b-12d3-a456-426614174000",
          status: "PUBLISHED",
          requires_attention: false,
          attention_reason: null,
          name: "Test AED",
          provisional_number: 1,
          code: "RM-001",
        },
      ];

      const csv = aedsToCsv(aeds);
      const lines = csv.split("\n");
      const headers = lines[0].split(";");

      expect(headers[0]).toBe("db_id");
      expect(headers[1]).toBe("dea_status");
      expect(headers[2]).toBe("possible_duplicate");
      expect(headers[3]).toBe("duplicate_info");
      expect(headers[4]).toBe("provisional_id");
      expect(headers[5]).toBe("RM_ID");
    });

    it("should include db_id, dea_status, and duplicate values in the CSV data rows", () => {
      const aeds = [
        {
          id: "123e4567-e89b-12d3-a456-426614174000",
          status: "PUBLISHED",
          requires_attention: false,
          attention_reason: null,
          name: "Test AED",
          provisional_number: 1,
          code: "RM-001",
        },
      ];

      const csv = aedsToCsv(aeds);
      const lines = csv.split("\n");
      const dataRow = lines[1].split(";");

      expect(dataRow[0]).toBe("123e4567-e89b-12d3-a456-426614174000");
      expect(dataRow[1]).toBe("PUBLISHED");
      expect(dataRow[2]).toBe("NO");
      expect(dataRow[3]).toBe("");
      expect(dataRow[4]).toBe("1");
      expect(dataRow[5]).toBe("RM-001");
    });

    it("should handle null/undefined id and status values", () => {
      const aeds = [
        {
          name: "Test AED Without ID",
          provisional_number: 2,
        },
      ];

      const csv = aedsToCsv(aeds);
      const lines = csv.split("\n");
      const dataRow = lines[1].split(";");

      expect(dataRow[0]).toBe("");
      expect(dataRow[1]).toBe("");
      expect(dataRow[2]).toBe("NO");
      expect(dataRow[3]).toBe("");
      expect(dataRow[4]).toBe("2");
    });

    it("should include all AED status types correctly", () => {
      const statuses = ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "INACTIVE", "REJECTED"];
      const aeds = statuses.map((status, index) => ({
        id: `id-${index}`,
        status,
        name: `AED ${status}`,
      }));

      const csv = aedsToCsv(aeds);
      const lines = csv.split("\n");

      statuses.forEach((status, index) => {
        const dataRow = lines[index + 1].split(";");
        expect(dataRow[1]).toBe(status);
      });
    });

    it("should mark possible duplicates correctly", () => {
      const aeds = [
        {
          id: "123e4567-e89b-12d3-a456-426614174000",
          status: "DRAFT",
          requires_attention: true,
          attention_reason:
            'Posible duplicado detectado: Similar a "Hospital Central" en "Calle Mayor 1" (score: 85/100). Requiere revisión manual.',
          name: "Hospital Centro",
          provisional_number: 1,
        },
      ];

      const csv = aedsToCsv(aeds);
      const lines = csv.split("\n");
      const dataRow = lines[1].split(";");

      expect(dataRow[2]).toBe("SÍ");
      expect(dataRow[3]).toContain("Posible duplicado detectado");
      expect(dataRow[3]).toContain("Hospital Central");
    });

    it("should not include JSON strings in the CSV output", () => {
      const aeds = [
        {
          id: "123e4567-e89b-12d3-a456-426614174000",
          status: "PUBLISHED",
          name: "Test AED",
          location: {
            street_type: "Calle",
            street_name: "Mayor",
            street_number: "1",
            postal_code: "28001",
            city_name: "Madrid",
            district_name: "Centro",
            neighborhood_name: "Sol",
          },
        },
      ];

      const csv = aedsToCsv(aeds);

      // JSON strings should never appear in CSV
      expect(csv).not.toContain("{");
      expect(csv).not.toContain("}");
      expect(csv).not.toContain("[object Object]");
    });
  });

  describe("generateExportFilename", () => {
    it("should generate a valid filename with timestamp", () => {
      const filename = generateExportFilename();
      expect(filename).toMatch(/^deas_\d{4}-\d{2}-\d{2}\.csv$/);
    });

    it("should include status filters in the filename", () => {
      const filename = generateExportFilename({ status: ["PUBLISHED", "DRAFT"] });
      expect(filename).toContain("published-draft");
    });
  });

  describe("createCsvBlob", () => {
    it("should create a blob with UTF-8 BOM", () => {
      const csvContent = "header1;header2\nvalue1;value2";
      const blob = createCsvBlob(csvContent);

      expect(blob.type).toBe("text/csv;charset=utf-8;");
    });
  });
});
