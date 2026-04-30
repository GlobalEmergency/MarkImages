/**
 * Geographic hierarchy: Country â†’ Community â†’ Province â†’ City
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

export const COUNTRIES: Country[] = [{ name: "EspaÃ±a", slug: "spain", code: "ES" }];

export const COUNTRY_BY_SLUG = new Map(COUNTRIES.map((c) => [c.slug, c]));
export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

/** Display names for countries by ISO code. Extends the static COUNTRIES list. */
const COUNTRY_DISPLAY_NAMES: Record<string, string> = {
  ES: "EspaÃ±a",
  FR: "Francia",
  DE: "Alemania",
  IT: "Italia",
  PT: "Portugal",
  GB: "Reino Unido",
  AT: "Austria",
  BE: "BÃ©lgica",
  NL: "PaÃ­ses Bajos",
  CH: "Suiza",
  PL: "Polonia",
  CZ: "RepÃºblica Checa",
  SE: "Suecia",
  NO: "Noruega",
  DK: "Dinamarca",
  FI: "Finlandia",
  IE: "Irlanda",
  GR: "Grecia",
  RO: "RumanÃ­a",
  HU: "HungrÃ­a",
  HR: "Croacia",
  SK: "Eslovaquia",
  SI: "Eslovenia",
  BG: "Bulgaria",
  LT: "Lituania",
  LV: "Letonia",
  EE: "Estonia",
  LU: "Luxemburgo",
  MT: "Malta",
  CY: "Chipre",
  US: "Estados Unidos",
  CA: "CanadÃ¡",
  MX: "MÃ©xico",
  BR: "Brasil",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  PE: "PerÃº",
  UY: "Uruguay",
  VE: "Venezuela",
  EC: "Ecuador",
  JP: "JapÃ³n",
  KR: "Corea del Sur",
  CN: "China",
  AU: "Australia",
  NZ: "Nueva Zelanda",
  IN: "India",
  ZA: "SudÃ¡frica",
  MA: "Marruecos",
  IL: "Israel",
  TR: "TurquÃ­a",
  RU: "Rusia",
  UA: "Ucrania",
};

/** Slug overrides for countries where ISO code doesn't make a good slug */
const COUNTRY_SLUG_OVERRIDES: Record<string, string> = {
  ES: "spain",
  FR: "france",
  DE: "germany",
  IT: "italy",
  PT: "portugal",
  GB: "united-kingdom",
  AT: "austria",
  BE: "belgium",
  NL: "netherlands",
  CH: "switzerland",
  US: "united-states",
  CA: "canada",
  MX: "mexico",
  BR: "brazil",
  AR: "argentina",
  UY: "uruguay",
  JP: "japan",
  AU: "australia",
};

/**
 * Resolve a Country from its ISO code. Returns static entry if available,
 * otherwise generates one dynamically from display name maps.
 */
export function countryFromCode(code: string): Country {
  const upper = code.toUpperCase();
  const existing = COUNTRY_BY_CODE.get(upper);
  if (existing) return existing;

  const name = COUNTRY_DISPLAY_NAMES[upper] || upper;
  const slug = COUNTRY_SLUG_OVERRIDES[upper] || toSlug(name);
  return { name, slug, code: upper };
}

/**
 * Resolve a Country from its URL slug. Checks static COUNTRIES first,
 * then tries to match against known slug overrides and display names.
 */
export function countryFromSlug(slug: string): Country | undefined {
  const existing = COUNTRY_BY_SLUG.get(slug);
  if (existing) return existing;

  // Check slug overrides (reverse lookup)
  for (const [code, s] of Object.entries(COUNTRY_SLUG_OVERRIDES)) {
    if (s === slug) return countryFromCode(code);
  }

  // Check display names (generate slug and compare)
  for (const [code, name] of Object.entries(COUNTRY_DISPLAY_NAMES)) {
    if (toSlug(name) === slug) return countryFromCode(code);
  }

  return undefined;
}

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
 * Map of normalized community names â†’ Community for fuzzy lookup.
 * Supports accent-insensitive matching so Nominatim results like
 * "Comunidad de Madrid" or "CataluÃ±a" match correctly.
 *
 * Also includes English aliases that Nominatim may return depending
 * on the accept-language header or data quality.
 */
const COMMUNITY_ALIASES: Record<string, string> = {
  "community of madrid": "Comunidad de Madrid",
  catalonia: "CataluÃ±a",
  "valencian community": "Comunitat Valenciana",
  "basque country": "PaÃ­s Vasco",
  "balearic islands": "Illes Balears",
  "canary islands": "Canarias",
  "region of murcia": "RegiÃ³n de Murcia",
  "castile and leon": "Castilla y LeÃ³n",
  "castile-la mancha": "Castilla-La Mancha",
  "principality of asturias": "Asturias",
  "chartered community of navarre": "Navarra",
  navarre: "Navarra",
  aragon: "AragÃ³n",
  andalusia: "AndalucÃ­a",
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

/** O(1) lookup: INE province code â†’ Community */
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
 * Priority: admin_level_1 â†’ ine_code â†’ null
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
 * Since `toSlug()` strips accents (NFD normalization), this is lossy â€”
 * use it as a hint for DB lookups, never as the canonical name.
 */
export function slugToApproxCityName(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Get the province for a given INE code (re-export for convenience) */
export { PROVINCE_BY_INE };
