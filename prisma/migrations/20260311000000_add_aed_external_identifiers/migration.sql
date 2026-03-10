-- Migration: Add aed_external_identifiers table for multi-source AED tracking
-- Enables tracking multiple external identifiers per AED across different data sources,
-- and supports disappearance detection when a source stops reporting an AED.

-- ============================================================
-- Part 1: Create aed_external_identifiers table
-- ============================================================

CREATE TABLE IF NOT EXISTS "aed_external_identifiers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aed_id" UUID NOT NULL,
    "data_source_id" UUID NOT NULL,
    "external_identifier" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_current_in_source" BOOLEAN NOT NULL DEFAULT true,
    "removed_from_source_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aed_external_identifiers_pkey" PRIMARY KEY ("id")
);

-- Each source has unique identifiers (can't have the same ID twice in one source)
CREATE UNIQUE INDEX IF NOT EXISTS "aed_external_identifiers_data_source_id_external_identifier_key"
    ON "aed_external_identifiers"("data_source_id", "external_identifier");

-- Find all identifiers for a given AED
CREATE INDEX IF NOT EXISTS "aed_external_identifiers_aed_id_idx"
    ON "aed_external_identifiers"("aed_id");

-- Find active/disappeared identifiers per source (used by disappearance detection)
CREATE INDEX IF NOT EXISTS "aed_external_identifiers_data_source_id_is_current_idx"
    ON "aed_external_identifiers"("data_source_id", "is_current_in_source");

-- Foreign keys with CASCADE delete
ALTER TABLE "aed_external_identifiers"
    ADD CONSTRAINT "aed_external_identifiers_aed_id_fkey"
    FOREIGN KEY ("aed_id") REFERENCES "aeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "aed_external_identifiers"
    ADD CONSTRAINT "aed_external_identifiers_data_source_id_fkey"
    FOREIGN KEY ("data_source_id") REFERENCES "external_data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================
-- Part 2: Create SAMUR ExternalDataSource record (idempotent)
-- ============================================================
-- Deterministic UUID v4 (version=4, variant=a) for scripting/migration references.
-- The SAMUR data source represents the Registro Municipal de DEAs from SAMUR.

INSERT INTO "external_data_sources" (
    "id", "name", "description", "type", "config",
    "source_origin", "region_code", "matching_strategy", "matching_threshold",
    "is_active", "sync_frequency", "auto_deactivate_missing",
    "default_status", "default_requires_attention",
    "created_at", "updated_at"
)
VALUES (
    'a0000001-0000-4000-a000-000000000001',
    'SAMUR - Registro Municipal',
    'Fuente oficial del Registro Municipal de DEAs del Ayuntamiento de Madrid (SAMUR). Datos iniciales importados desde CSV legacy.',
    'JSON_FILE',
    '{"url": "", "fieldMappings": {}}',
    'LEGACY_MIGRATION',
    'MAD',
    'BY_EXTERNAL_CODE',
    90,
    false,
    'MANUAL',
    false,
    'PUBLISHED',
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO NOTHING;


-- ============================================================
-- Part 3: Data migration — populate aed_external_identifiers
-- ============================================================

-- 3a. AEDs without a data source (SAMUR origin: LEGACY_MIGRATION, CSV_IMPORT, WEB_FORM)
-- These are the original AEDs imported from SAMUR CSV, manual entry, or legacy migration.
-- All pre-existing AEDs without an explicit data source are attributed to SAMUR.
-- Their external_reference contains legacy numeric IDs (e.g., "55", "3440").
INSERT INTO "aed_external_identifiers" (
    "aed_id", "data_source_id", "external_identifier",
    "first_seen_at", "last_seen_at", "is_current_in_source"
)
SELECT
    a."id",
    'a0000001-0000-4000-a000-000000000001',
    a."external_reference",
    COALESCE(a."created_at", CURRENT_TIMESTAMP),
    COALESCE(a."last_synced_at", a."created_at", CURRENT_TIMESTAMP),
    true
FROM "aeds" a
WHERE a."external_reference" IS NOT NULL
  AND a."external_reference" != ''
  AND a."data_source_id" IS NULL
ON CONFLICT ("data_source_id", "external_identifier") DO NOTHING;

-- 3b. AEDs already assigned to an ExternalDataSource (e.g., CM source)
INSERT INTO "aed_external_identifiers" (
    "aed_id", "data_source_id", "external_identifier",
    "first_seen_at", "last_seen_at", "is_current_in_source"
)
SELECT
    a."id",
    a."data_source_id",
    a."external_reference",
    COALESCE(a."created_at", CURRENT_TIMESTAMP),
    COALESCE(a."last_synced_at", a."created_at", CURRENT_TIMESTAMP),
    true
FROM "aeds" a
WHERE a."external_reference" IS NOT NULL
  AND a."external_reference" != ''
  AND a."data_source_id" IS NOT NULL
ON CONFLICT ("data_source_id", "external_identifier") DO NOTHING;

-- 3c. Assign SAMUR data_source_id to ALL AEDs that have none
-- Covers LEGACY_MIGRATION, CSV_IMPORT, and WEB_FORM source origins.
-- Future imports will go through ExternalSyncService with proper data_source_id.
UPDATE "aeds"
SET "data_source_id" = 'a0000001-0000-4000-a000-000000000001',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "data_source_id" IS NULL;


-- ============================================================
-- Summary
-- ============================================================
DO $$
DECLARE
  total_identifiers INT;
  samur_identifiers INT;
  other_identifiers INT;
  samur_aeds_updated INT;
BEGIN
  SELECT COUNT(*) INTO total_identifiers FROM "aed_external_identifiers";
  SELECT COUNT(*) INTO samur_identifiers FROM "aed_external_identifiers"
    WHERE "data_source_id" = 'a0000001-0000-4000-a000-000000000001';
  SELECT COUNT(*) INTO other_identifiers FROM "aed_external_identifiers"
    WHERE "data_source_id" != 'a0000001-0000-4000-a000-000000000001';
  SELECT COUNT(*) INTO samur_aeds_updated FROM "aeds"
    WHERE "data_source_id" = 'a0000001-0000-4000-a000-000000000001';

  RAISE NOTICE 'Migration completed:';
  RAISE NOTICE '  - Total external identifiers: %', total_identifiers;
  RAISE NOTICE '  - SAMUR identifiers: %', samur_identifiers;
  RAISE NOTICE '  - Other source identifiers: %', other_identifiers;
  RAISE NOTICE '  - AEDs assigned to SAMUR data source: %', samur_aeds_updated;
END $$;
