import { describe, it, expect } from "vitest";
import { HtmlStripTransformer } from "@/import/domain/services/HtmlStripTransformer";

describe("HtmlStripTransformer", () => {
  const transformer = new HtmlStripTransformer();

  it("replaces <br> with ' | '", async () => {
    const result = await transformer.transform("Haupteingang<br>Bei Eingang läuten");
    expect(result.confidence).toBe(1.0);
    expect(result.fields.accessDescription).toBe("Haupteingang | Bei Eingang läuten");
  });

  it("replaces <br/> and <br /> variants", async () => {
    const result = await transformer.transform("Line1<br/>Line2<br />Line3");
    expect(result.fields.accessDescription).toBe("Line1 | Line2 | Line3");
  });

  it("strips other HTML tags", async () => {
    const result = await transformer.transform("Test <b>bold</b> and <i>italic</i>");
    expect(result.fields.accessDescription).toBe("Test bold and italic");
  });

  it("handles mixed <br> and other tags", async () => {
    const result = await transformer.transform(
      "Von der Straße kommend<br>Nehmen Sie die <b>1.</b> Zufahrt"
    );
    expect(result.fields.accessDescription).toBe(
      "Von der Straße kommend | Nehmen Sie die 1. Zufahrt"
    );
  });

  it("handles empty input", async () => {
    const result = await transformer.transform("");
    expect(result.confidence).toBe(0);
  });

  it("normalizes whitespace", async () => {
    const result = await transformer.transform("  Multiple   spaces   here  ");
    expect(result.fields.accessDescription).toBe("Multiple spaces here");
  });
});
