import { describe, it, expect } from "vitest";
import { aedImportSchema } from "../../../../src/import/domain/schemas/aedImportSchema";
import { getTranslation as t } from "../../../../src/lib/i18n";

describe("aedImportSchema - Localized Messages", () => {
  const findField = (name: string) => aedImportSchema.fields.find((f) => f.name === name);

  it("should return localized message for invalid postal code", () => {
    const field = findField("postalCode");
    expect(field?.customValidator).toBeDefined();

    const result = field!.customValidator!("123");
    expect(result.valid).toBe(false);
    expect(result.message).toBe(t("import_validation.invalid_postal_code"));
    expect(result.suggestion).toBe(t("import_validation.invalid_postal_code"));
  });

  it("should return localized message for invalid latitude", () => {
    const field = findField("latitude");

    // Test NaN
    const res1 = field!.customValidator!("abc");
    expect(res1.valid).toBe(false);
    expect(res1.message).toBe(t("import_validation.invalid_latitude"));

    // Test Out of Range
    const res2 = field!.customValidator!("95");
    expect(res2.valid).toBe(false);
    expect(res2.message).toBe(t("import_validation.invalid_latitude"));
  });

  it("should return localized message for invalid longitude", () => {
    const field = findField("longitude");

    const res = field!.customValidator!("200");
    expect(res.valid).toBe(false);
    expect(res.message).toBe(t("import_validation.invalid_longitude"));
  });

  it("should return localized message for invalid email", () => {
    const field = findField("submitterEmail");

    const res = field!.customValidator!("invalid-email");
    expect(res.valid).toBe(false);
    expect(res.message).toBe(t("import_validation.invalid_email"));
  });

  it("should return localized message for invalid time format", () => {
    const field = findField("weekdayOpening");

    const res = field!.customValidator!("25:00");
    expect(res.valid).toBe(false);
    expect(res.message).toBe(t("import_validation.invalid_time"));
  });

  it("should return localized message for too short name", () => {
    const field = findField("proposedName");

    const res = field!.customValidator!("Ab");
    expect(res.valid).toBe(true); // Warning only
    expect(res.severity).toBe("warning");
    expect(res.message).toBe(t("import_validation.name_too_short"));
  });
});
