/**
 * Safely serialize an object for inline JSON-LD script tags.
 * Escapes `</` sequences to prevent XSS when DB values contain `</script>`.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
