-- Change FK on aed_external_identifiers.data_source_id from CASCADE to SET NULL
-- Prevents losing external identifiers when a data source is deleted/recreated
-- The identifiers remain as orphan records that can be re-linked

-- 1. Make data_source_id nullable
ALTER TABLE "aed_external_identifiers"
  ALTER COLUMN "data_source_id" DROP NOT NULL;

-- 2. Drop old CASCADE FK
ALTER TABLE "aed_external_identifiers"
  DROP CONSTRAINT IF EXISTS "aed_external_identifiers_data_source_id_fkey";

-- 3. Re-create FK with SET NULL behavior
ALTER TABLE "aed_external_identifiers"
  ADD CONSTRAINT "aed_external_identifiers_data_source_id_fkey"
  FOREIGN KEY ("data_source_id") REFERENCES "external_data_sources"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
