import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/client/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding test data for E2E tests...");

  // Create test organization
  console.log("🏢 Creating test organization...");
  const testOrg = await prisma.organization.upsert({
    where: { id: "test-org-e2e" },
    update: {},
    create: {
      id: "test-org-e2e",
      name: "Test Organization",
      normalizedName: "test organization",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  console.log(`✅ Organization created: ${testOrg.name}`);

  // Create test user
  console.log("👤 Creating test user...");
  const testUser = await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      email: "test@example.com",
      name: "Test User",
      normalizedName: "test user",
      role: "USER",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  console.log(`✅ User created: ${testUser.email}`);

  // Create organization member
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: testOrg.id,
        userId: testUser.id,
      },
    },
    update: {},
    create: {
      organizationId: testOrg.id,
      userId: testUser.id,
      role: "ADMIN",
      joinedAt: new Date(),
    },
  });

  console.log("\n✅ Test data seeded successfully");
  console.log("\n📊 Summary:");
  console.log(`   - Organizations: 1`);
  console.log(`   - Users: 1`);
  console.log(`   - Organization Members: 1`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Error during seeding:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
