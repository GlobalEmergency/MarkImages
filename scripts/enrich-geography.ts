/**
 * Geographic Enrichment Script
 *
 * Runs locally to enrich AED records with geographic hierarchy data from Nominatim.
 * Populates admin_level_1 (region/state) using coordinates as the source of truth.
 *
 * Safety features:
 * - Skips records where Nominatim country != stored country_code (wrong coordinates)
 * - Skips Null Island (0,0) coordinates
 * - Caches geocode results for identical coordinates (saves API calls)
 * - Marks processed records with nominatim_verified_at to support resume
 *
 * Usage:
 *   npx tsx scripts/enrich-geography.ts [options]
 *
 * Options:
 *   --dry-run              Preview changes without writing to DB (default: true)
 *   --write                Actually write changes to DB
 *   --limit N              Process only N records (default: all)
 *   --offset N             Skip first N records (default: 0)
 *   --only-unverified      Only process records not yet verified by Nominatim (default: true)
 *   --all                  Process all records, even already verified ones
 *   --fix-city-code        Also fix city_code prefix from Nominatim result
 *   --country ES           Only process records from this country
 *   --report               Generate CSV reports (mismatches + wrong countries)
 *   --random               Randomize record order (for diverse geographic sampling)
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/client/client";
import { reverseGeocode, type ReverseGeocodeResult } from "../src/lib/nominatim";

const SYSTEM_USER_UUID = "00000000-0000-0000-0000-000000000000";
const CHANGE_SOURCE = "IMPORT" as const;

// --- Coordinate validation ---

function isNullIsland(lat: number, lon: number): boolean {
  return Math.abs(lat) < 0.1 && Math.abs(lon) < 0.1;
}

/**
 * Check if a postal code is plausibly valid for a given country.
 * Used to cross-validate stored country_code vs Nominatim coordinates.
 *
 * If the postal code matches the stored country's format, there's a real
 * conflict (coordinates say one country, postal code says another).
 * If it doesn't match, the coordinates win and we fix country_code.
 */
const POSTAL_CODE_VALIDATORS: Record<string, (pc: string) => boolean> = {
  // Spain: 5 digits, prefix 01-52
  ES: (pc) =>
    /^\d{5}$/.test(pc) &&
    parseInt(pc.substring(0, 2), 10) >= 1 &&
    parseInt(pc.substring(0, 2), 10) <= 52,
  // France: 5 digits, prefix 01-95 or 97-98 (DOM-TOM)
  FR: (pc) => /^\d{5}$/.test(pc),
  // Germany: 5 digits
  DE: (pc) => /^\d{5}$/.test(pc),
  // Italy: 5 digits
  IT: (pc) => /^\d{5}$/.test(pc),
  // Portugal: 4 digits, dash, 3 digits (or just 4 digits)
  PT: (pc) => /^\d{4}(-\d{3})?$/.test(pc),
  // UK: alphanumeric pattern
  GB: (pc) => /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(pc),
};

function postalCodeMatchesCountry(postalCode: string | null, countryCode: string): boolean {
  if (!postalCode) return false;
  const validator = POSTAL_CODE_VALIDATORS[countryCode.toUpperCase()];
  if (!validator) return false; // Unknown country format — can't validate
  return validator(postalCode);
}

// --- Geocode result cache ---
const geocodeCache = new Map<string, ReverseGeocodeResult | null>();

function coordKey(lat: number, lon: number): string {
  return `${lat.toFixed(6)},${lon.toFixed(6)}`;
}

async function cachedReverseGeocode(
  lat: number,
  lon: number
): Promise<ReverseGeocodeResult | null> {
  const key = coordKey(lat, lon);
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  const result = await reverseGeocode(lat, lon);
  geocodeCache.set(key, result);
  return result;
}

// --- CLI ---

interface Options {
  dryRun: boolean;
  limit: number | null;
  offset: number;
  onlyUnverified: boolean;
  fixCityCode: boolean;
  country: string | null;
  report: boolean;
  random: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const opts: Options = {
    dryRun: true,
    limit: null,
    offset: 0,
    onlyUnverified: true,
    fixCityCode: false,
    country: null,
    report: false,
    random: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--write":
        opts.dryRun = false;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--limit":
        opts.limit = parseInt(args[++i], 10);
        break;
      case "--offset":
        opts.offset = parseInt(args[++i], 10);
        break;
      case "--only-unverified":
        opts.onlyUnverified = true;
        break;
      case "--all":
        opts.onlyUnverified = false;
        break;
      case "--fix-city-code":
        opts.fixCityCode = true;
        break;
      case "--country":
        opts.country = args[++i]?.toUpperCase();
        break;
      case "--report":
        opts.report = true;
        break;
      case "--random":
        opts.random = true;
        break;
    }
  }

  return opts;
}

interface Mismatch {
  aedId: string;
  cityName: string | null;
  currentAdmin: string | null;
  nominatimAdmin: string | null;
  currentCityCode: string | null;
  nominatimPostalCode: string | null;
  lat: number;
  lon: number;
}

interface WrongCountry {
  aedId: string;
  name: string | null;
  cityName: string | null;
  storedCountry: string;
  nominatimCountry: string;
  lat: number;
  lon: number;
  action: "fixed" | "conflict";
  reason: string;
}

async function main() {
  const opts = parseArgs();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });
  const startTime = Date.now();

  console.log("=== Geographic Enrichment Script ===");
  console.log(`Mode: ${opts.dryRun ? "DRY RUN (no writes)" : "WRITE MODE"}`);
  console.log(`Options:`, JSON.stringify(opts, null, 2));
  console.log();

  try {
    // Build WHERE clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      latitude: { not: null },
      longitude: { not: null },
    };

    if (opts.onlyUnverified) {
      where.location = { nominatim_verified_at: null };
    }

    if (opts.country) {
      where.country_code = opts.country;
    }

    const totalCount = await prisma.aed.count({ where });
    const processCount = opts.limit ? Math.min(opts.limit, totalCount) : totalCount;

    console.log(`Total AEDs matching criteria: ${totalCount}`);
    console.log(`Will process: ${processCount} (offset: ${opts.offset})`);
    console.log(
      `Estimated time: ~${Math.ceil((processCount * 1.1) / 60)} minutes (less with cache hits)`
    );
    console.log();

    // Use raw query for random ordering (Prisma doesn't support ORDER BY RANDOM())
    // For sequential ordering, use Prisma's findMany
    let aeds: {
      id: string;
      name: string | null;
      latitude: number | null;
      longitude: number | null;
      country_code: string | null;
      location: {
        id: string;
        city_name: string | null;
        city_code: string | null;
        postal_code: string | null;
        admin_level_1: string | null;
      } | null;
    }[];

    if (opts.random) {
      // Random sampling via raw SQL for geographic diversity
      const verifiedFilter = opts.onlyUnverified ? `AND l.nominatim_verified_at IS NULL` : "";
      const countryFilter = opts.country ? `AND a.country_code = '${opts.country}'` : "";
      const limitClause = processCount ? `LIMIT ${processCount}` : "";

      const rawAeds = (await prisma.$queryRawUnsafe(`
        SELECT a.id, a.name, a.latitude, a.longitude, a.country_code,
               l.id as location_id, l.city_name, l.city_code, l.postal_code, l.admin_level_1
        FROM aeds a
        JOIN aed_locations l ON l.id = a.location_id
        WHERE a.latitude IS NOT NULL AND a.longitude IS NOT NULL
          ${verifiedFilter} ${countryFilter}
        ORDER BY RANDOM()
        ${limitClause}
      `)) as {
        id: string;
        name: string | null;
        latitude: number;
        longitude: number;
        country_code: string | null;
        location_id: string;
        city_name: string | null;
        city_code: string | null;
        postal_code: string | null;
        admin_level_1: string | null;
      }[];

      aeds = rawAeds.map((r) => ({
        id: r.id,
        name: r.name,
        latitude: r.latitude,
        longitude: r.longitude,
        country_code: r.country_code,
        location: {
          id: r.location_id,
          city_name: r.city_name,
          city_code: r.city_code,
          postal_code: r.postal_code,
          admin_level_1: r.admin_level_1,
        },
      }));
    } else {
      aeds = await prisma.aed.findMany({
        where,
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
          country_code: true,
          location: {
            select: {
              id: true,
              city_name: true,
              city_code: true,
              postal_code: true,
              admin_level_1: true,
            },
          },
        },
        orderBy: { created_at: "asc" },
        skip: opts.offset,
        take: processCount,
      });
    }

    let enriched = 0;
    let skipped = 0;
    let failed = 0;
    let mismatches = 0;
    let cacheHits = 0;
    let nullIslands = 0;
    let wrongCountries = 0;
    let countryFixed = 0;
    let countryConflict = 0;
    const mismatchList: Mismatch[] = [];
    const wrongCountryList: WrongCountry[] = [];

    for (let i = 0; i < aeds.length; i++) {
      const aed = aeds[i];
      const lat = aed.latitude!;
      const lon = aed.longitude!;
      const locationId = aed.location?.id;

      if (!locationId) {
        skipped++;
        continue;
      }

      // Skip Null Island (0,0) — clearly invalid coordinates
      if (isNullIsland(lat, lon)) {
        nullIslands++;
        skipped++;
        // Still mark as verified so we don't reprocess
        if (!opts.dryRun) {
          await prisma.aedLocation.update({
            where: { id: locationId },
            data: { nominatim_verified_at: new Date() },
          });
        }
        continue;
      }

      // Progress
      if ((i + 1) % 100 === 0 || i === 0) {
        const pct = (((i + 1) / aeds.length) * 100).toFixed(1);
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(
          `[${pct}%] Processing ${i + 1}/${aeds.length} (enriched: ${enriched}, failed: ${failed}, wrong_country: ${wrongCountries}, cache: ${cacheHits}, elapsed: ${elapsed}s)`
        );
      }

      // Check cache
      const key = coordKey(lat, lon);
      if (geocodeCache.has(key)) cacheHits++;

      const result = await cachedReverseGeocode(lat, lon);

      if (!result) {
        failed++;
        continue;
      }

      // Country mismatch check — coordinates don't match stored country
      if (
        aed.country_code &&
        result.countryCode &&
        aed.country_code.toUpperCase() !== result.countryCode.toUpperCase()
      ) {
        wrongCountries++;
        const storedPostal = aed.location?.postal_code ?? null;
        const postalConfirmsStored = postalCodeMatchesCountry(storedPostal, aed.country_code);

        if (postalConfirmsStored) {
          // Postal code matches stored country → real conflict, coordinates might be wrong
          countryConflict++;
          wrongCountryList.push({
            aedId: aed.id,
            name: aed.name,
            cityName: aed.location?.city_name || null,
            storedCountry: aed.country_code,
            nominatimCountry: result.countryCode,
            lat,
            lon,
            action: "conflict",
            reason: `postal_code "${storedPostal}" matches ${aed.country_code} format`,
          });
          // Mark as verified but DON'T enrich — needs manual review
          if (!opts.dryRun) {
            await prisma.aedLocation.update({
              where: { id: locationId },
              data: { nominatim_verified_at: new Date() },
            });
          }
          skipped++;
          continue;
        }

        // No postal evidence for stored country → coordinates win, fix country_code
        countryFixed++;
        wrongCountryList.push({
          aedId: aed.id,
          name: aed.name,
          cityName: aed.location?.city_name || null,
          storedCountry: aed.country_code,
          nominatimCountry: result.countryCode,
          lat,
          lon,
          action: "fixed",
          reason: storedPostal
            ? `postal_code "${storedPostal}" does NOT match ${aed.country_code} format`
            : "no postal_code to corroborate stored country",
        });

        // Fix country_code on the AED and continue with normal enrichment
        if (!opts.dryRun) {
          await prisma.$transaction(async (tx) => {
            await tx.aed.update({
              where: { id: aed.id },
              data: { country_code: result.countryCode },
            });
            await tx.aedFieldChange.create({
              data: {
                aed_id: aed.id,
                field_name: "country_code",
                old_value: aed.country_code!,
                new_value: result.countryCode,
                changed_by: SYSTEM_USER_UUID,
                change_source: CHANGE_SOURCE,
              },
            });
          });
        }
        // Fall through to enrich with Nominatim data (admin_level_1, postal, etc.)
      }

      // Check for city_code mismatches (Spain only)
      const currentAdmin = aed.location?.admin_level_1 ?? null;
      const currentCityCode = aed.location?.city_code ?? null;
      const currentPostal = aed.location?.postal_code ?? null;

      let cityCodeMismatch = false;
      if (result.countryCode === "ES" && currentCityCode && result.postalCode) {
        const currentPrefix = currentCityCode.substring(0, 2);
        const nominatimPrefix = result.postalCode.substring(0, 2);
        if (currentPrefix !== nominatimPrefix) {
          cityCodeMismatch = true;
          mismatches++;
          mismatchList.push({
            aedId: aed.id,
            cityName: aed.location?.city_name || null,
            currentAdmin,
            nominatimAdmin: result.adminLevel1,
            currentCityCode,
            nominatimPostalCode: result.postalCode,
            lat,
            lon,
          });
        }
      }

      // Build update and track field changes for audit trail
      const update: Record<string, string | Date | undefined> = {
        nominatim_verified_at: new Date(),
      };
      const fieldChanges: { field: string; oldValue: string; newValue: string }[] = [];

      if (result.adminLevel1 && result.adminLevel1 !== currentAdmin) {
        update.admin_level_1 = result.adminLevel1;
        fieldChanges.push({
          field: "admin_level_1",
          oldValue: currentAdmin || "",
          newValue: result.adminLevel1,
        });
      }

      // Fill missing city_name from Nominatim
      const currentCity = aed.location?.city_name ?? null;
      if (!currentCity && result.city) {
        update.city_name = result.city;
        fieldChanges.push({
          field: "city_name",
          oldValue: "",
          newValue: result.city,
        });
      }

      if (opts.fixCityCode && cityCodeMismatch && result.postalCode) {
        const newPrefix = result.postalCode.substring(0, 2);
        const oldSuffix = currentCityCode!.substring(2);
        const newCityCode = newPrefix + oldSuffix;
        update.city_code = newCityCode;
        fieldChanges.push({
          field: "city_code",
          oldValue: currentCityCode || "",
          newValue: newCityCode,
        });
      }

      // Fill missing postal_code
      if (!currentPostal && result.postalCode) {
        update.postal_code = result.postalCode;
        fieldChanges.push({
          field: "postal_code",
          oldValue: "",
          newValue: result.postalCode,
        });
      }

      if (!opts.dryRun) {
        // Transaction: update location + record field changes in audit trail
        await prisma.$transaction(async (tx) => {
          await tx.aedLocation.update({
            where: { id: locationId },
            data: update,
          });

          // Record each field change for full traceability
          for (const change of fieldChanges) {
            await tx.aedFieldChange.create({
              data: {
                aed_id: aed.id,
                field_name: change.field,
                old_value: change.oldValue,
                new_value: change.newValue,
                changed_by: SYSTEM_USER_UUID,
                change_source: CHANGE_SOURCE,
              },
            });
          }
        });
      }

      enriched++;
    }

    console.log();
    console.log("=== Results ===");
    console.log(`Processed:     ${aeds.length}`);
    console.log(`Enriched:      ${enriched}`);
    console.log(`Skipped:       ${skipped}`);
    console.log(`Failed:        ${failed}`);
    console.log(`Cache hits:    ${cacheHits}`);
    console.log(`Null Islands:  ${nullIslands}`);
    console.log(`Mismatches:    ${mismatches} (city_code prefix != Nominatim postal)`);
    console.log(
      `Wrong country: ${wrongCountries} (${countryFixed} fixed, ${countryConflict} conflicts — manual review)`
    );
    console.log(`Time:          ${Math.round((Date.now() - startTime) / 1000)}s`);

    if (opts.dryRun && enriched > 0) {
      console.log();
      console.log("This was a DRY RUN. Run with --write to apply changes.");
    }

    // Reports
    if (opts.report) {
      const fs = await import("fs");
      const date = new Date().toISOString().slice(0, 10);

      if (mismatchList.length > 0) {
        const csv = [
          "aed_id,city_name,current_admin,nominatim_admin,current_city_code,nominatim_postal,lat,lon",
          ...mismatchList.map((m) =>
            [
              m.aedId,
              `"${m.cityName || ""}"`,
              `"${m.currentAdmin || ""}"`,
              `"${m.nominatimAdmin || ""}"`,
              m.currentCityCode,
              m.nominatimPostalCode,
              m.lat,
              m.lon,
            ].join(",")
          ),
        ].join("\n");
        const path = `geographic-mismatches-${date}.csv`;
        fs.writeFileSync(path, csv);
        console.log(`\nMismatch report: ${path}`);
      }

      if (wrongCountryList.length > 0) {
        const csv = [
          "aed_id,name,city_name,stored_country,nominatim_country,lat,lon,action,reason",
          ...wrongCountryList.map((w) =>
            [
              w.aedId,
              `"${w.name || ""}"`,
              `"${w.cityName || ""}"`,
              w.storedCountry,
              w.nominatimCountry,
              w.lat,
              w.lon,
              w.action,
              `"${w.reason}"`,
            ].join(",")
          ),
        ].join("\n");
        const path = `wrong-country-${date}.csv`;
        fs.writeFileSync(path, csv);
        console.log(`Wrong country report: ${path}`);
      }
    }

    if (wrongCountryList.length > 0) {
      console.log();
      console.log(`=== Wrong Country (${wrongCountryList.length} total, showing first 10) ===`);
      for (const w of wrongCountryList.slice(0, 10)) {
        console.log(
          `  [${w.action.toUpperCase()}] ${w.aedId}: "${w.name}" ${w.storedCountry}→${w.nominatimCountry} | ${w.reason}`
        );
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
