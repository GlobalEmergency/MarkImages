import esLocale from "../locales/es.json";

/**
 * Obtiene una traducción del diccionario de forma segura.
 * Compatible con Server Components y Client Components.
 */
export function getTranslation(
  path: string,
  replacements?: Record<string, string | number>
): string {
  const keys = path.split(".");
  let current: unknown = esLocale;

  for (const key of keys) {
    if (typeof current === "object" && current !== null && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path; // Fallback a la ruta si no se encuentra
    }
  }

  if (typeof current !== "string") {
    return path;
  }

  let result = current;
  if (replacements) {
    for (const [key, val] of Object.entries(replacements)) {
      result = result.replace(new RegExp(`{{${key}}}`, "g"), String(val));
    }
  }

  return result;
}
