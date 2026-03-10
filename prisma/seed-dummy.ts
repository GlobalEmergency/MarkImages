/**
 * Dummy Data Seeder for Branch Databases
 *
 * Generates 500 realistic DEAs with varied statuses, locations,
 * schedules, and responsible parties across all Madrid districts.
 *
 * Usage: npx tsx prisma/seed-dummy.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, AedStatus, SourceOrigin, PublicationMode } from "@/generated/client/client";
import { faker } from "@faker-js/faker/locale/es";
import madridData from "./data/madrid-districts.json";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Configuration
const CONFIG = {
  totalAeds: 500,
  batchSize: 50, // Insert in batches for performance
  statusDistribution: {
    PUBLISHED: 0.6,
    DRAFT: 0.15,
    PENDING_REVIEW: 0.1,
    INACTIVE: 0.1,
    REJECTED: 0.05,
  },
  sourceOriginDistribution: {
    WEB_FORM: 0.3,
    ADMIN_FORM: 0.2,
    EXCEL_IMPORT: 0.15,
    LEGACY_MIGRATION: 0.15,
    EXTERNAL_API: 0.1,
    CITIZEN_REPORT: 0.1,
  },
  publicationModeDistribution: {
    LOCATION_ONLY: 0.4,
    BASIC_INFO: 0.35,
    FULL: 0.2,
    NONE: 0.05,
  },
};

// Helper to pick based on weighted distribution
function pickWeighted<T extends string>(distribution: Record<T, number>): T {
  const rand = Math.random();
  let cumulative = 0;
  for (const [key, weight] of Object.entries(distribution)) {
    cumulative += weight as number;
    if (rand <= cumulative) {
      return key as T;
    }
  }
  return Object.keys(distribution)[0] as T;
}

// Helper to pick random item from array
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper to pick establishment type based on weight
function pickEstablishmentType(): { type: string; subtype: string } {
  const totalWeight = madridData.establishmentTypes.reduce((sum, e) => sum + e.weight, 0);
  let rand = Math.random() * totalWeight;

  for (const est of madridData.establishmentTypes) {
    rand -= est.weight;
    if (rand <= 0) {
      return {
        type: est.type,
        subtype: pickRandom(est.subtypes),
      };
    }
  }

  const fallback = madridData.establishmentTypes[0];
  return { type: fallback.type, subtype: fallback.subtypes[0] };
}

// Helper to pick schedule template based on weight
function pickScheduleTemplate() {
  const totalWeight = madridData.scheduleTemplates.reduce((sum, s) => sum + s.weight, 0);
  let rand = Math.random() * totalWeight;

  for (const sched of madridData.scheduleTemplates) {
    rand -= sched.weight;
    if (rand <= 0) {
      return sched;
    }
  }

  return madridData.scheduleTemplates[0];
}

// Generate random coordinates within district bounds
function generateCoordinates(district: (typeof madridData.districts)[0]) {
  const lat = faker.number.float({
    min: district.bounds.minLat,
    max: district.bounds.maxLat,
    fractionDigits: 6,
  });
  const lng = faker.number.float({
    min: district.bounds.minLng,
    max: district.bounds.maxLng,
    fractionDigits: 6,
  });
  return { lat, lng };
}

// Generate realistic street name
function generateStreetName(): string {
  const streetNames = [
    "Gran Vía",
    "Alcalá",
    "Serrano",
    "Velázquez",
    "Goya",
    "Princesa",
    "Bravo Murillo",
    "López de Hoyos",
    "Arturo Soria",
    "Francisco Silvela",
    "Doctor Esquerdo",
    "Conde de Casal",
    "Atocha",
    "Embajadores",
    "Toledo",
    "Mayor",
    "Arenal",
    "Preciados",
    "Carmen",
    "Montera",
    "Fuencarral",
    "Hortaleza",
    "San Bernardo",
    "Alberto Aguilera",
    "Cea Bermúdez",
    "José Abascal",
    "María de Molina",
    "Príncipe de Vergara",
    "Castellana",
    "Paseo del Prado",
    "Paseo de Recoletos",
    "Paseo de la Habana",
    "General Perón",
    "Orense",
    "Raimundo Fernández Villaverde",
    "Santa Engracia",
    "Ríos Rosas",
    "Alonso Cano",
    "Ponzano",
    "García de Paredes",
    "Luchana",
    "Eloy Gonzalo",
    "Trafalgar",
    "Sagasta",
    "Génova",
    "Almagro",
    "Zurbano",
    "Bárbara de Braganza",
  ];
  return faker.helpers.arrayElement(streetNames);
}

// Generate responsible name based on establishment type
function generateResponsibleName(establishmentType: string): string {
  const prefixes: Record<string, string[]> = {
    "Centro educativo": ["Director/a", "Coordinador/a de Seguridad", "Jefe/a de Estudios"],
    "Centro deportivo": ["Director/a Deportivo", "Coordinador/a", "Gerente"],
    "Centro comercial": ["Director/a de Seguridad", "Jefe/a de Mantenimiento", "Gerente"],
    "Centro de salud": [
      "Director/a Médico",
      "Coordinador/a de Enfermería",
      "Responsable de Seguridad",
    ],
    Empresa: ["Director/a de RRHH", "Responsable de Prevención", "Facility Manager"],
    default: ["Responsable", "Coordinador/a", "Encargado/a"],
  };

  const prefix = pickRandom(prefixes[establishmentType] || prefixes.default);
  return `${prefix} - ${faker.person.fullName()}`;
}

// Generate email based on establishment
function generateEmail(establishmentName: string, domain?: string): string {
  const sanitized = establishmentName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, ".")
    .replace(/\.+/g, ".")
    .substring(0, 20);

  const domains = domain
    ? [domain]
    : ["madrid.es", "comunidad.madrid", "gmail.com", "hotmail.com", "outlook.es"];

  return `${sanitized}@${pickRandom(domains)}`;
}

// Districts are reference data only (not persisted to DB)
// The schema uses denormalized district fields for multi-city support
async function loadDistrictsReference() {
  console.log("📍 Loading districts reference data...");
  console.log(`✅ Loaded ${madridData.districts.length} districts from JSON (reference only)`);
}

// Map JSON organization types to Prisma enum values
function mapOrganizationType(
  jsonType: string
):
  | "CIVIL_PROTECTION"
  | "CERTIFIED_COMPANY"
  | "VOLUNTEER_GROUP"
  | "MUNICIPALITY"
  | "HEALTH_SERVICE"
  | "OWNER" {
  const typeMap: Record<
    string,
    | "CIVIL_PROTECTION"
    | "CERTIFIED_COMPANY"
    | "VOLUNTEER_GROUP"
    | "MUNICIPALITY"
    | "HEALTH_SERVICE"
    | "OWNER"
  > = {
    emergency: "CIVIL_PROTECTION",
    government: "MUNICIPALITY",
    commercial: "CERTIFIED_COMPANY",
    health: "HEALTH_SERVICE",
    hospital: "HEALTH_SERVICE",
    transport: "MUNICIPALITY", // Transport falls under municipality
    enterprise: "CERTIFIED_COMPANY", // Enterprise is a certified company
  };
  return typeMap[jsonType.toLowerCase()] || "CERTIFIED_COMPANY";
}

// Generate unique organization code
function generateOrgCode(name: string): string {
  return name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "_")
    .substring(0, 50);
}

// Create organizations
async function createOrganizations() {
  console.log("🏢 Creating organizations...");

  const orgIds: string[] = [];

  for (const org of madridData.organizations) {
    const orgCode = generateOrgCode(org.name);
    const created = await prisma.organization.upsert({
      where: { code: orgCode },
      update: {},
      create: {
        code: orgCode,
        name: org.name,
        description: `Organización ${org.type} - ${org.name}`,
        type: mapOrganizationType(org.type),
        is_active: true,
        email: generateEmail(org.name),
        phone: faker.phone.number({ style: "national" }),
      },
    });
    orgIds.push(created.id);
  }

  console.log(`✅ Created ${madridData.organizations.length} organizations`);
  return orgIds;
}

// Create test users
async function createTestUsers() {
  console.log("👤 Creating test users...");

  // Create specific admin user for testing
  await prisma.user.upsert({
    where: { email: "admin@deamap.es" },
    update: {},
    create: {
      email: "admin@deamap.es",
      password_hash: "$2a$12$4K2OfmPm3siMhBLTfKrQved1KQ2kVutUh4dFwQuU1NXyWHP1eb/2C", // bcrypt hash for "123456"
      name: "Admin DEA Map",
      role: "ADMIN",
      is_active: true,
      is_verified: true,
    },
  });

  const roles = ["ADMIN", "MODERATOR", "USER"];
  const userCount = 20;

  for (let i = 0; i < userCount; i++) {
    const role = roles[i % roles.length];
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    await prisma.user.upsert({
      where: { email: `test.user${i + 1}@deamap.test` },
      update: {},
      create: {
        email: `test.user${i + 1}@deamap.test`,
        password_hash: "$2a$10$dummyhashfortesting", // Dummy bcrypt hash for testing
        name: `${firstName} ${lastName}`,
        role: role as "ADMIN" | "MODERATOR" | "USER",
        is_active: true,
      },
    });
  }

  // Create org editor user with working password (same as admin: "123456")
  await prisma.user.upsert({
    where: { email: "editor@deamap.es" },
    update: {},
    create: {
      email: "editor@deamap.es",
      password_hash: "$2a$12$4K2OfmPm3siMhBLTfKrQved1KQ2kVutUh4dFwQuU1NXyWHP1eb/2C", // bcrypt hash for "123456"
      name: "Editor Organización",
      role: "USER",
      is_active: true,
      is_verified: true,
    },
  });

  // Create verifier user with working password
  await prisma.user.upsert({
    where: { email: "verificador@deamap.es" },
    update: {},
    create: {
      email: "verificador@deamap.es",
      password_hash: "$2a$12$4K2OfmPm3siMhBLTfKrQved1KQ2kVutUh4dFwQuU1NXyWHP1eb/2C", // bcrypt hash for "123456"
      name: "Verificador Organización",
      role: "USER",
      is_active: true,
      is_verified: true,
    },
  });

  console.log(
    `✅ Created ${userCount + 3} test users (including admin, editor, verificador @deamap.es)`
  );
}

// Generate a single AED with all related data
async function createAed(index: number, districtSequences: Map<number, number>) {
  const district = pickRandom(madridData.districts);
  const establishment = pickEstablishmentType();
  const scheduleTemplate = pickScheduleTemplate();
  const coords = generateCoordinates(district);
  const status = pickWeighted(CONFIG.statusDistribution) as AedStatus;
  const sourceOrigin = pickWeighted(CONFIG.sourceOriginDistribution) as SourceOrigin;
  const publicationMode = pickWeighted(CONFIG.publicationModeDistribution) as PublicationMode;

  // Get next sequence for this district
  const currentSeq = districtSequences.get(district.code) || 0;
  const newSeq = currentSeq + 1;
  districtSequences.set(district.code, newSeq);

  const code = `${district.textCode}-${String(newSeq).padStart(3, "0")}`;
  const establishmentName = `${establishment.subtype} ${faker.company.name().split(" ")[0]}`;

  // Create location (coordinates are now only in Aed table)
  const location = await prisma.aedLocation.create({
    data: {
      street_type: pickRandom(madridData.streetTypes),
      street_name: generateStreetName(),
      street_number: String(faker.number.int({ min: 1, max: 200 })),
      postal_code: pickRandom(district.postalCodes),
      city_name: "Madrid",
      city_code: "079",
      district_code: district.textCode,
      district_name: district.name,
      location_details: faker.helpers.maybe(
        () => `Planta ${faker.number.int({ min: 0, max: 5 })}`,
        {
          probability: 0.3,
        }
      ),
      access_instructions: faker.helpers.maybe(
        () =>
          faker.helpers.arrayElement([
            "Entrada principal, junto a recepción",
            "En el vestíbulo, al lado del ascensor",
            "Planta baja, zona de seguridad",
            "Acceso por puerta lateral",
            "Junto al punto de información",
            "En la zona de emergencias",
            "Visible desde la entrada principal",
          ]),
        { probability: 0.7 }
      ),
    },
  });

  // Create responsible
  const responsible = await prisma.aedResponsible.create({
    data: {
      name: generateResponsibleName(establishment.type),
      email: generateEmail(establishmentName),
      phone: faker.phone.number({ style: "national" }),
      ownership: pickRandom(["Público", "Privado"]),
      local_ownership: pickRandom(["Pública", "Privada"]),
      local_use: pickRandom(["Público", "Privado", "Mixto"]),
      organization: establishmentName,
      position: faker.person.jobTitle(),
    },
  });

  // Create schedule
  const schedule = await prisma.aedSchedule.create({
    data: {
      description: scheduleTemplate.name,
      has_24h_surveillance: scheduleTemplate.has24h || false,
      has_restricted_access: faker.datatype.boolean({ probability: 0.3 }),
      weekday_opening: scheduleTemplate.weekdayOpen || null,
      weekday_closing: scheduleTemplate.weekdayClose || null,
      saturday_opening: scheduleTemplate.saturdayOpen || null,
      saturday_closing: scheduleTemplate.saturdayClose || null,
      sunday_opening: scheduleTemplate.sundayOpen || null,
      sunday_closing: scheduleTemplate.sundayClose || null,
      closed_on_holidays: scheduleTemplate.closedHolidays || false,
      closed_in_august: scheduleTemplate.closedAugust || false,
      notes: faker.helpers.maybe(
        () =>
          faker.helpers.arrayElement([
            "Acceso restringido fuera de horario",
            "Solicitar acceso en recepción",
            "Vigilancia las 24 horas",
            "Personal de seguridad presente",
          ]),
        { probability: 0.4 }
      ),
    },
  });

  // Create AED
  const publishedAt = status === "PUBLISHED" ? faker.date.past({ years: 2 }) : null;
  const lastVerifiedAt =
    status === "PUBLISHED"
      ? faker.helpers.maybe(() => faker.date.recent({ days: 180 }), { probability: 0.6 })
      : null;

  // Generate internal notes as JSON array
  const internalNotesArray = faker.helpers.maybe(
    () => [
      {
        text: faker.lorem.sentence(),
        type: "observation",
        date: faker.date.recent({ days: 90 }).toISOString(),
      },
    ],
    { probability: 0.2 }
  );

  const aed = await prisma.aed.create({
    data: {
      code,
      provisional_number: faker.number.int({ min: 1000, max: 9999 }),
      name: establishmentName,
      establishment_type: establishment.type,
      latitude: coords.lat,
      longitude: coords.lng,
      coordinates_precision: pickRandom(["high", "medium", "low"]),
      source_origin: sourceOrigin,
      status,
      publication_mode: publicationMode,
      published_at: publishedAt,
      last_verified_at: lastVerifiedAt,
      verification_method: lastVerifiedAt
        ? pickRandom(["field_visit", "phone_call", "email", "photo_verification"])
        : null,
      is_publicly_accessible: faker.datatype.boolean({ probability: 0.85 }),
      installation_date: faker.helpers.maybe(() => faker.date.past({ years: 5 }), {
        probability: 0.5,
      }),
      requires_attention:
        status === "PENDING_REVIEW" || faker.datatype.boolean({ probability: 0.1 }),
      rejection_reason:
        status === "REJECTED"
          ? pickRandom(["Ubicación incorrecta", "DEA no encontrado", "Duplicado", "Datos falsos"])
          : null,
      location_id: location.id,
      responsible_id: responsible.id,
      schedule_id: schedule.id,
      internal_notes: internalNotesArray,
    },
  });

  // Create code history
  await prisma.aedCodeHistory.create({
    data: {
      aed_id: aed.id,
      code,
      district: district.code,
      sequential: newSeq,
      is_active: true,
      change_reason: "Código inicial asignado",
    },
  });

  // Create status changes (realistic history)
  const statusHistory: { status: AedStatus; date: Date }[] = [];
  const createdDate = faker.date.past({ years: 2 });

  statusHistory.push({ status: "DRAFT", date: createdDate });

  if (status !== "DRAFT") {
    const reviewDate = faker.date.between({ from: createdDate, to: new Date() });

    if (status === "REJECTED") {
      statusHistory.push({ status: "PENDING_REVIEW", date: reviewDate });
      statusHistory.push({
        status: "REJECTED",
        date: faker.date.between({ from: reviewDate, to: new Date() }),
      });
    } else if (status === "PENDING_REVIEW") {
      statusHistory.push({ status: "PENDING_REVIEW", date: reviewDate });
    } else if (status === "PUBLISHED" || status === "INACTIVE") {
      statusHistory.push({ status: "PENDING_REVIEW", date: reviewDate });
      const publishDate = faker.date.between({ from: reviewDate, to: new Date() });
      statusHistory.push({ status: "PUBLISHED", date: publishDate });

      if (status === "INACTIVE") {
        statusHistory.push({
          status: "INACTIVE",
          date: faker.date.between({ from: publishDate, to: new Date() }),
        });
      }
    }
  }

  for (let i = 0; i < statusHistory.length; i++) {
    const change = statusHistory[i];
    const prevStatus = i > 0 ? statusHistory[i - 1].status : null;

    await prisma.aedStatusChange.create({
      data: {
        aed_id: aed.id,
        previous_status: prevStatus,
        new_status: change.status,
        reason: i === 0 ? "Creación inicial" : getStatusChangeReason(prevStatus, change.status),
        notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
        created_at: change.date,
      },
    });
  }

  return aed;
}

// Create org memberships for test users
// Links editor and verificador to SAMUR - Protección Civil (CIVIL_PROTECTION)
async function createOrgMemberships(_orgIds: string[]) {
  console.log("🔗 Creating organization memberships...");

  // Find SAMUR - Protección Civil org by code
  const samurCode = generateOrgCode("SAMUR - Protección Civil");
  const samurOrg = await prisma.organization.findUnique({ where: { code: samurCode } });

  if (!samurOrg) {
    console.log("   ⚠️ SAMUR org not found, skipping memberships");
    return;
  }

  // Assign editor@deamap.es to SAMUR with can_edit
  const editor = await prisma.user.findUnique({ where: { email: "editor@deamap.es" } });
  if (editor) {
    await prisma.organizationMember.upsert({
      where: {
        organization_id_user_id: {
          organization_id: samurOrg.id,
          user_id: editor.id,
        },
      },
      update: {},
      create: {
        organization_id: samurOrg.id,
        user_id: editor.id,
        can_edit: true,
        can_verify: false,
        can_approve: false,
        can_manage_members: false,
      },
    });
  }

  // Assign verificador@deamap.es to SAMUR with can_verify + can_edit
  const verificador = await prisma.user.findUnique({
    where: { email: "verificador@deamap.es" },
  });
  if (verificador) {
    await prisma.organizationMember.upsert({
      where: {
        organization_id_user_id: {
          organization_id: samurOrg.id,
          user_id: verificador.id,
        },
      },
      update: {},
      create: {
        organization_id: samurOrg.id,
        user_id: verificador.id,
        can_edit: true,
        can_verify: true,
        can_approve: false,
        can_manage_members: false,
      },
    });
  }

  console.log(`✅ Created org memberships for editor and verificador → ${samurOrg.name}`);
}

function getStatusChangeReason(from: AedStatus | null, to: AedStatus): string {
  const reasons: Record<string, string[]> = {
    DRAFT_PENDING_REVIEW: [
      "Enviado para revisión",
      "Datos completados",
      "Solicitud de publicación",
    ],
    PENDING_REVIEW_PUBLISHED: [
      "Verificación completada",
      "Datos validados",
      "Aprobado por administrador",
    ],
    PENDING_REVIEW_REJECTED: ["Datos incorrectos", "No se pudo verificar", "Ubicación no válida"],
    PUBLISHED_INACTIVE: ["DEA retirado", "Mantenimiento", "Cierre temporal", "Cambio de ubicación"],
    default: ["Actualización de estado"],
  };

  const key = `${from}_${to}`;
  return pickRandom(reasons[key] || reasons.default);
}

async function main() {
  console.log("🌱 Starting dummy data seed...\n");
  console.log(`📊 Configuration:`);
  console.log(`   - Total DEAs: ${CONFIG.totalAeds}`);
  console.log(`   - Districts: ${madridData.districts.length}`);
  console.log(`   - Batch size: ${CONFIG.batchSize}\n`);

  // Load reference data and create base data
  await loadDistrictsReference();
  const orgIds = await createOrganizations();
  await createTestUsers();
  await createOrgMemberships(orgIds);

  // Track sequences per district for code generation
  const districtSequences = new Map<number, number>();

  // Create DEAs
  console.log(`\n🏥 Creating ${CONFIG.totalAeds} DEAs...`);

  let created = 0;
  const startTime = Date.now();

  for (let i = 0; i < CONFIG.totalAeds; i++) {
    await createAed(i, districtSequences);
    created++;

    if (created % CONFIG.batchSize === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (created / parseFloat(elapsed)).toFixed(1);
      console.log(`   ✓ ${created}/${CONFIG.totalAeds} DEAs created (${rate}/s)`);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n✅ Dummy data seed completed!`);
  console.log(`\n📊 Summary:`);
  console.log(`   - Districts (reference): ${madridData.districts.length}`);
  console.log(`   - Organizations: ${madridData.organizations.length}`);
  console.log(`   - Test users: 23 (including admin, editor, verificador)`);
  console.log(`   - DEAs: ${CONFIG.totalAeds}`);
  console.log(`   - Time: ${totalTime}s`);

  // Show status distribution
  const statusCounts = await prisma.aed.groupBy({
    by: ["status"],
    _count: true,
  });

  console.log(`\n📈 Status distribution:`);
  for (const { status, _count } of statusCounts) {
    const pct = ((_count / CONFIG.totalAeds) * 100).toFixed(1);
    console.log(`   - ${status}: ${_count} (${pct}%)`);
  }
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
