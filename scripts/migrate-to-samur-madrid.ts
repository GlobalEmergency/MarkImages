/**
 * Data Migration Script: Assign existing AEDs to SAMUR Madrid
 *
 * This script:
 * 1. Creates SAMUR Madrid organization if it doesn't exist
 * 2. Assigns all existing AEDs to SAMUR Madrid
 * 3. Creates initial verifications for published AEDs
 * 4. Updates locations with Madrid city code
 *
 * Run with: npx tsx scripts/migrate-to-samur-madrid.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/client/client";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const connectionString = process.env.DATABASE_URL || "";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Madrid city code (INE)
const MADRID_CITY_CODE = "28079";
const MADRID_CITY_NAME = "Madrid";

async function main() {
  console.log("🚀 Starting data migration to SAMUR Madrid...\n");

  try {
    // ============================================
    // 1. Create SAMUR Madrid organization
    // ============================================
    console.log("📋 Step 1: Creating SAMUR Madrid organization...");

    let samurMadrid = await prisma.organization.findUnique({
      where: { code: "SAMUR_MADRID" },
    });

    if (!samurMadrid) {
      samurMadrid = await prisma.organization.create({
        data: {
          type: "CIVIL_PROTECTION",
          name: "SAMUR - Protección Civil Madrid",
          code: "SAMUR_MADRID",
          email: "samur@madrid.es",
          phone: "112",
          scope_type: "CITY",
          city_code: MADRID_CITY_CODE,
          city_name: MADRID_CITY_NAME,
          district_codes: [], // All districts in Madrid
          require_approval: true,
          approval_authority: "Ayuntamiento de Madrid",
          badge_name: "Verificado por SAMUR",
          badge_icon: "🚒",
          badge_color: "#DC2626", // Red
          is_active: true,
        },
      });
      console.log("✅ SAMUR Madrid organization created:", samurMadrid.id);
    } else {
      console.log("✅ SAMUR Madrid organization already exists:", samurMadrid.id);
    }

    // ============================================
    // 2. Update all locations with Madrid city code
    // ============================================
    console.log("\n📍 Step 2: Updating locations with Madrid city code...");

    const locationsUpdated = await prisma.aedLocation.updateMany({
      where: {
        city_code: null, // Only update if not already set
      },
      data: {
        city_code: MADRID_CITY_CODE,
        city_name: MADRID_CITY_NAME,
      },
    });

    console.log(`✅ Updated ${locationsUpdated.count} locations with Madrid city code`);

    // ============================================
    // 3. Get all AEDs without assignments
    // ============================================
    console.log("\n🏥 Step 3: Finding AEDs without organization assignments...");

    const allAeds = await prisma.aed.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        publication_mode: true,
        assignments: {
          where: { status: "ACTIVE" },
        },
      },
    });

    const aedsWithoutAssignment = allAeds.filter((aed) => aed.assignments.length === 0);

    console.log(`📊 Found ${allAeds.length} total AEDs`);
    console.log(`📊 Found ${aedsWithoutAssignment.length} AEDs without assignments`);

    if (aedsWithoutAssignment.length === 0) {
      console.log("✅ All AEDs already have assignments");
      return;
    }

    // ============================================
    // 4. Create assignments for all AEDs
    // ============================================
    console.log("\n🔗 Step 4: Creating assignments to SAMUR Madrid...");

    let assignmentsCreated = 0;
    let verificationsCreated = 0;

    for (const aed of aedsWithoutAssignment) {
      try {
        // Determine publication_mode based on current status
        let publicationMode: "NONE" | "LOCATION_ONLY" | "BASIC_INFO" | "FULL" = "LOCATION_ONLY";
        let approvedForFull = false;
        let approvedByAuthority = false;

        if (aed.status === "PUBLISHED") {
          // If already published, use current publication_mode or default to FULL
          publicationMode = (aed.publication_mode as any) || "FULL";
          approvedForFull = true;
          approvedByAuthority = true; // Assume already approved
        } else if (aed.status === "PENDING_REVIEW") {
          publicationMode = "LOCATION_ONLY";
          approvedForFull = false;
          approvedByAuthority = false;
        } else {
          // DRAFT, INACTIVE, REJECTED
          publicationMode = "NONE";
          approvedForFull = false;
          approvedByAuthority = false;
        }

        // Create assignment
        const assignment = await prisma.aedOrganizationAssignment.create({
          data: {
            aed_id: aed.id,
            organization_id: samurMadrid.id,
            assignment_type: "CIVIL_PROTECTION",
            status: "ACTIVE",
            publication_mode: publicationMode,
            approved_for_full: approvedForFull,
            approved_by_authority: approvedByAuthority,
            approval_notes: "Initial migration - existing AED assigned to SAMUR Madrid",
            assigned_at: new Date(),
          },
        });

        assignmentsCreated++;

        // Create verification for published AEDs
        if (aed.status === "PUBLISHED") {
          await prisma.aedOrganizationVerification.create({
            data: {
              aed_id: aed.id,
              organization_id: samurMadrid.id,
              verification_type: "INFORMAL",
              verified_by: "SYSTEM", // System migration
              verified_at: new Date(),
              verified_address: true,
              verified_schedule: true,
              verified_photos: true,
              verified_access: true,
              verified_signage: false,
              is_current: true,
              notes: "Initial verification from migration - existing published AED",
            },
          });

          verificationsCreated++;
        }

        if (assignmentsCreated % 100 === 0) {
          console.log(`   Processed ${assignmentsCreated} AEDs...`);
        }
      } catch (error) {
        console.error(`❌ Error processing AED ${aed.code || aed.id}:`, error);
      }
    }

    console.log(`✅ Created ${assignmentsCreated} assignments`);
    console.log(`✅ Created ${verificationsCreated} verifications`);

    // ============================================
    // 5. Summary
    // ============================================
    console.log("\n📊 Migration Summary:");
    console.log("=".repeat(50));

    const finalStats = await prisma.aedOrganizationAssignment.groupBy({
      by: ["status", "publication_mode"],
      where: {
        organization_id: samurMadrid.id,
      },
      _count: true,
    });

    console.log("\nAssignments by status and publication mode:");
    for (const stat of finalStats) {
      console.log(`  ${stat.status} - ${stat.publication_mode}: ${stat._count} AEDs`);
    }

    const totalVerifications = await prisma.aedOrganizationVerification.count({
      where: {
        organization_id: samurMadrid.id,
        is_current: true,
      },
    });

    console.log(`\nTotal current verifications: ${totalVerifications}`);
    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
