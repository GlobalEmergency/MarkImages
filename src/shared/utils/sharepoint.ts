/**
 * SharePoint URL Detection Utility
 *
 * Utilidad compartida para detectar URLs de SharePoint de forma segura.
 * Centraliza la lógica que antes estaba duplicada en:
 * - aedImportHooks.ts
 * - SharePointDetectionService.ts
 * - SharePointImageDownloader.ts
 *
 * Usa `endsWith` en lugar de `includes` para evitar falsos positivos
 * (ej: "fakesharepoint.com" o "notsharepoint.com.evil.com").
 *
 * Nota: "microsoft.sharepoint.com" no se incluye porque ya termina
 * en ".sharepoint.com" y queda cubierto por la regla general.
 */

/** Dominios válidos de SharePoint */
const SHAREPOINT_DOMAINS = ["sharepoint.com", "sharepoint-df.com"] as const;

/**
 * Verifica si una URL pertenece a SharePoint.
 *
 * Matching seguro con `endsWith` para prevenir falsos positivos:
 * - ✅ "company.sharepoint.com" → true
 * - ✅ "company-my.sharepoint.com" → true
 * - ✅ "microsoft.sharepoint.com" → true (ends with .sharepoint.com)
 * - ✅ "sharepoint.com" → true (exact match)
 * - ❌ "fakesharepoint.com" → false
 * - ❌ "notsharepoint.com.evil.com" → false
 *
 * @param url - URL completa a verificar
 * @returns true si la URL pertenece a un dominio de SharePoint
 */
export function isSharePointUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    return SHAREPOINT_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

/**
 * Verifica si un hostname pertenece a SharePoint.
 * Variante que acepta hostname directamente (sin parsear URL).
 *
 * @param hostname - Hostname a verificar (ej: "company.sharepoint.com")
 * @returns true si pertenece a SharePoint
 */
export function isSharePointHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return SHAREPOINT_DOMAINS.some(
    (domain) => normalized === domain || normalized.endsWith(`.${domain}`)
  );
}

/** Lista de dominios de SharePoint (solo lectura) */
export { SHAREPOINT_DOMAINS };
