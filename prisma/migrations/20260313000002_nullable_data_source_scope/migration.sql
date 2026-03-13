-- Make country_code and region_code nullable on external_data_sources
-- Allows broader scope: null country = global/multi-country, null region = entire country
-- Existing rows keep their values (no data loss)

ALTER TABLE "external_data_sources"
  ALTER COLUMN "country_code" DROP NOT NULL,
  ALTER COLUMN "country_code" DROP DEFAULT,
  ALTER COLUMN "region_code" DROP NOT NULL;
