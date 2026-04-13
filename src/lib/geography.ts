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

/** Given a province INE code, find which community it belongs to */
export function communityForIneCode(ineCode: string): Community | undefined {
  return COMMUNITIES.find((c) => c.provinceIneCodes.includes(ineCode));
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
