/**
 * Geographic Enrichment Script
 *
 * Runs locally to enrich AED records with geographic hierarchy data from Nominatim.
 * Populates admin_level_1 (region/state) and optionally fixes city_name, postal_code,
 * and city_code using coordinates as the source of truth.
 *
 * Usage:
 *   npx tsx scripts/enrich-geography.ts [options]
 *
 * Options:
 *   --dry-run          Preview changes without writing to DB (default: true)
 *   --write            Actually write changes to DB (sets dry-run to false)
 *   --limit N          Process only N records (default: all)
 *   --offset N         Skip first N records (default: 0)
 *   --only-missing     Only process records where admin_level_1 IS NULL (default: false)
 *   --fix-city-code    Also fix city_code prefix from Nominatim result (default: false)
 *   --country ES       Only process records from this country (default: all)
 *   --report           Generate a CSV report of mismatches (default: false)
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/client/client";
import { reverseGeocode } from "../src/lib/nominatim";

// --- CLI ---

interface Options {
  dryRun: boolean;
  limit: number | null;
  offset: number;
  onlyMissing: boolean;
  fixCityCode: boolean;
  country: string | null;
  report: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const opts: Options = {
    dryRun: true,
    limit: null,
    offset: 0,
    onlyMissing: false,
    fixCityCode: false,
    country: null,
    report: false,
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
      case "--only-missing":
        opts.onlyMissing = true;
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

    if (opts.onlyMissing) {
      where.location = { admin_level_1: null };
    }

    if (opts.country) {
      where.country_code = opts.country;
    }

    const totalCount = await prisma.aed.count({ where });
    const processCount = opts.limit ? Math.min(opts.limit, totalCount) : totalCount;

    console.log(`Total AEDs matching criteria: ${totalCount}`);
    console.log(`Will process: ${processCount} (offset: ${opts.offset})`);
    console.log(`Estimated time: ~${Math.ceil((processCount * 1.1) / 60)} minutes`);
    console.log();

    const aeds = await prisma.aed.findMany({
      where,
      select: {
        id: true,
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

    let enriched = 0;
    let skipped = 0;
    let failed = 0;
    let mismatches = 0;
    const mismatchList: Mismatch[] = [];

    for (let i = 0; i < aeds.length; i++) {
      const aed = aeds[i];
      const lat = aed.latitude!;
      const lon = aed.longitude!;
      const locationId = aed.location?.id;

      if (!locationId) {
        skipped++;
        continue;
      }

      // Progress
      if ((i + 1) % 100 === 0 || i === 0) {
        const pct = (((i + 1) / aeds.length) * 100).toFixed(1);
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(
          `[${pct}%] Processing ${i + 1}/${aeds.length} (enriched: ${enriched}, failed: ${failed}, mismatches: ${mismatches}, elapsed: ${elapsed}s)`
        );
      }

      const result = await reverseGeocode(lat, lon);

      if (!result) {
        failed++;
        continue;
      }

      // Check for mismatches
      const currentAdmin = aed.location?.admin_level_1;
      const currentCityCode = aed.location?.city_code;
      const currentPostal = aed.location?.postal_code;

      // For Spain: check if city_code prefix matches Nominatim-derived province
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

      // Build update
      const update: Record<string, string | undefined> = {};

      if (result.adminLevel1) {
        update.admin_level_1 = result.adminLevel1;
      }

      if (opts.fixCityCode && cityCodeMismatch && result.postalCode) {
        const newPrefix = result.postalCode.substring(0, 2);
        const oldSuffix = currentCityCode!.substring(2);
        update.city_code = newPrefix + oldSuffix;
      }

      // Fill missing postal_code from Nominatim
      if (!currentPostal && result.postalCode) {
        update.postal_code = result.postalCode;
      }

      if (Object.keys(update).length === 0) {
        skipped++;
        continue;
      }

      if (!opts.dryRun) {
        await prisma.aedLocation.update({
          where: { id: locationId },
          data: update,
        });
      }

      enriched++;
    }

    console.log();
    console.log("=== Results ===");
    console.log(`Processed:  ${aeds.length}`);
    console.log(`Enriched:   ${enriched}`);
    console.log(`Skipped:    ${skipped}`);
    console.log(`Failed:     ${failed}`);
    console.log(`Mismatches: ${mismatches}`);
    console.log(`Time:       ${Math.round((Date.now() - startTime) / 1000)}s`);

    if (opts.dryRun && enriched > 0) {
      console.log();
      console.log("This was a DRY RUN. Run with --write to apply changes.");
    }

    // Report
    if (opts.report && mismatchList.length > 0) {
      const fs = await import("fs");
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

      const reportPath = `geographic-mismatches-${new Date().toISOString().slice(0, 10)}.csv`;
      fs.writeFileSync(reportPath, csv);
      console.log();
      console.log(`Mismatch report saved to: ${reportPath}`);
    }

    if (mismatchList.length > 0 && mismatchList.length <= 20) {
      console.log();
      console.log("=== Sample Mismatches ===");
      for (const m of mismatchList.slice(0, 10)) {
        console.log(
          `  ${m.cityName}: city_code=${m.currentCityCode} → postal=${m.nominatimPostalCode} | admin: "${m.currentAdmin}" → "${m.nominatimAdmin}"`
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
