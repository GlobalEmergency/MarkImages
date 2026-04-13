/**
 * Geographic hierarchy: Country → Community → Province → City
 * Used for /locations URL structure and SEO pages.
 */

import { PROVINCES, PROVINCE_BY_INE, toSlug } from "./provinces";

export { toSlug } from "./provinces";

// --- Countries ---

export interface Country {
  name: string;
  slug: string;
  code: string; // ISO 3166-1 alpha-2
}

export const COUNTRIES: Country[] = [{ name: "España", slug: "spain", code: "ES" }];

export const COUNTRY_BY_SLUG = new Map(COUNTRIES.map((c) => [c.slug, c]));
export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

// --- Communities (Autonomous Regions in Spain) ---

export interface Community {
  name: string;
  slug: string;
  countryCode: string;
  provinceIneCodes: string[];
}

// Build communities from provinces
const communityMap = new Map<string, { name: string; ineCodes: string[] }>();
for (const p of PROVINCES) {
  const existing = communityMap.get(p.community);
  if (existing) {
    existing.ineCodes.push(p.ineCode);
  } else {
    communityMap.set(p.community, { name: p.community, ineCodes: [p.ineCode] });
  }
}

export const COMMUNITIES: Community[] = [...communityMap.entries()]
  .map(([, { name, ineCodes }]) => ({
    name,
    slug: toSlug(name),
    countryCode: "ES",
    provinceIneCodes: ineCodes,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "es"));

export const COMMUNITY_BY_SLUG = new Map(COMMUNITIES.map((c) => [c.slug, c]));

// --- URL builders ---

export function countryPath(country: Country | string): string {
  const slug = typeof country === "string" ? country : country.slug;
  return `/locations/${slug}`;
}

export function communityPath(countrySlug: string, community: Community | string): string {
  const slug = typeof community === "string" ? community : community.slug;
  return `/locations/${countrySlug}/${slug}`;
}

export function cityPath(countrySlug: string, communitySlug: string, cityName: string): string {
  return `/locations/${countrySlug}/${communitySlug}/${toSlug(cityName)}`;
}

export function absoluteCityUrl(
  countrySlug: string,
  communitySlug: string,
  cityName: string
): string {
  return `https://deamap.es${cityPath(countrySlug, communitySlug, cityName)}`;
}

// --- Lookup helpers ---

/** Normalize a string for accent-insensitive matching */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Map of normalized community names → Community for fuzzy lookup.
 * Supports accent-insensitive matching so Nominatim results like
 * "Comunidad de Madrid" or "Cataluña" match correctly.
 *
 * Also includes English aliases that Nominatim may return depending
 * on the accept-language header or data quality.
 */
const COMMUNITY_ALIASES: Record<string, string> = {
  "community of madrid": "Comunidad de Madrid",
  catalonia: "Cataluña",
  "valencian community": "Comunitat Valenciana",
  "basque country": "País Vasco",
  "balearic islands": "Illes Balears",
  "canary islands": "Canarias",
  "region of murcia": "Región de Murcia",
  "castile and leon": "Castilla y León",
  "castile-la mancha": "Castilla-La Mancha",
  "principality of asturias": "Asturias",
  "chartered community of navarre": "Navarra",
  navarre: "Navarra",
  aragon: "Aragón",
  andalusia: "Andalucía",
  extremadura: "Extremadura",
  galicia: "Galicia",
  cantabria: "Cantabria",
  "la rioja": "La Rioja",
  ceuta: "Ceuta",
  melilla: "Melilla",
};

const COMMUNITY_BY_NAME = new Map<string, Community>();
for (const c of COMMUNITIES) {
  COMMUNITY_BY_NAME.set(normalizeForMatch(c.name), c);
}
for (const [alias, canonical] of Object.entries(COMMUNITY_ALIASES)) {
  const community = COMMUNITY_BY_NAME.get(normalizeForMatch(canonical));
  if (community) COMMUNITY_BY_NAME.set(normalizeForMatch(alias), community);
}

/** O(1) lookup: INE province code → Community */
const COMMUNITY_BY_INE_CODE = new Map<string, Community>();
for (const c of COMMUNITIES) {
  for (const ineCode of c.provinceIneCodes) {
    COMMUNITY_BY_INE_CODE.set(ineCode, c);
  }
}

/** Given a province INE code, find which community it belongs to */
export function communityForIneCode(ineCode: string): Community | undefined {
  return COMMUNITY_BY_INE_CODE.get(ineCode);
}

/**
 * Given an admin_level_1 name (from Nominatim), find the matching community.
 * Uses accent-insensitive matching. Works for Spain; for other countries
 * returns undefined (use regionSlugFromAdminLevel1 instead).
 */
export function communityForAdminLevel1(adminLevel1: string): Community | undefined {
  return COMMUNITY_BY_NAME.get(normalizeForMatch(adminLevel1));
}

/**
 * Generate a URL-safe slug from any admin_level_1 name.
 * Used for countries without a static community map (non-Spain).
 */
export function regionSlugFromAdminLevel1(adminLevel1: string): string {
  return toSlug(adminLevel1);
}

/**
 * Resolve a region slug from admin_level_1 OR ine_code, with fallback chain.
 * This is the primary function for determining the region in geographic queries.
 *
 * Priority: admin_level_1 → ine_code → null
 */
export function resolveRegionSlug(
  adminLevel1: string | null,
  ineCode: string | null
): string | null {
  if (adminLevel1) {
    const community = communityForAdminLevel1(adminLevel1);
    if (community) return community.slug;
    // For non-Spain countries, generate slug dynamically
    return regionSlugFromAdminLevel1(adminLevel1);
  }
  if (ineCode) {
    const community = communityForIneCode(ineCode);
    if (community) return community.slug;
  }
  return null;
}

/**
 * Resolve a region display name from admin_level_1 OR ine_code.
 */
export function resolveRegionName(
  adminLevel1: string | null,
  ineCode: string | null
): string | null {
  if (adminLevel1) {
    const community = communityForAdminLevel1(adminLevel1);
    if (community) return community.name;
    return adminLevel1; // Use raw name for non-Spain countries
  }
  if (ineCode) {
    const community = communityForIneCode(ineCode);
    if (community) return community.name;
  }
  return null;
}

/** Given a province INE code, build the full path for a city in that province */
export function cityPathFromIne(ineCode: string, cityName: string): string {
  const community = communityForIneCode(ineCode);
  if (!community) return `/locations/spain/${toSlug(cityName)}`;
  return cityPath("spain", community.slug, cityName);
}

/**
 * Best-effort reverse of `toSlug()` for city names.
 * Since `toSlug()` strips accents (NFD normalization), this is lossy —
 * use it as a hint for DB lookups, never as the canonical name.
 */
export function slugToApproxCityName(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Get the province for a given INE code (re-export for convenience) */
export { PROVINCE_BY_INE };
