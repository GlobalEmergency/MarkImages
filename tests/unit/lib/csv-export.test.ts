import { describe, it, expect } from "vitest";
import { aedsToCsv, generateExportFilename, createCsvBlob } from "@/lib/csv-export";

describe("csv-export", () => {
  describe("aedsToCsv", () => {
    it("should include db_id and dea_status columns in the CSV headers", () => {
      const aeds = [
        {
          id: "123e4567-e89b-12d3-a456-426614174000",
          status: "PUBLISHED",
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
      expect(headers[2]).toBe("provisional_id");
      expect(headers[3]).toBe("RM_ID");
    });

    it("should include db_id and dea_status values in the CSV data rows", () => {
      const aeds = [
        {
          id: "123e4567-e89b-12d3-a456-426614174000",
          status: "PUBLISHED",
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
      expect(dataRow[2]).toBe("1");
      expect(dataRow[3]).toBe("RM-001");
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
      expect(dataRow[2]).toBe("2");
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
