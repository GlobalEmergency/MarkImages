/**
 * SSRF protection: validates that URLs used by data source adapters
 * point to external, public resources — not internal infrastructure.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal",
  "169.254.169.254", // AWS/GCP metadata
]);

const PRIVATE_IP_PREFIXES = [
  "10.", // 10.0.0.0/8
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.", // 172.16.0.0/12
  "192.168.", // 192.168.0.0/16
];

/**
 * Validates that a URL is safe to fetch (no SSRF to internal services).
 * Throws if the URL targets a private/internal host.
 */
export function validateExternalUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`URL inválida: ${url}`);
  }

  // Only allow http/https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Protocolo no permitido: ${parsed.protocol} (solo http/https)`);
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`URL bloqueada: no se permiten conexiones a ${hostname}`);
  }

  if (PRIVATE_IP_PREFIXES.some((prefix) => hostname.startsWith(prefix))) {
    throw new Error(`URL bloqueada: no se permiten direcciones IP privadas (${hostname})`);
  }

  // Block .local and .internal TLDs
  if (hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error(`URL bloqueada: no se permiten dominios internos (${hostname})`);
  }
}
