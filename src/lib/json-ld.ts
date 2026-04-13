/**
 * Safely serialize an object for inline JSON-LD script tags.
 * Escapes characters that can break HTML/XML parsers when embedded in <script>.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");
}
