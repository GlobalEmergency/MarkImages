-- Add country_code support for European expansion
-- Defaults to 'ES' (Spain) for all existing records

-- Aed: country_code
ALTER TABLE aeds ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) NOT NULL DEFAULT 'ES';
CREATE INDEX IF NOT EXISTS idx_aeds_country_code ON aeds(country_code);
CREATE INDEX IF NOT EXISTS idx_aeds_country_status ON aeds(country_code, status);

-- ExternalDataSource: country_code
ALTER TABLE external_data_sources ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) NOT NULL DEFAULT 'ES';
CREATE INDEX IF NOT EXISTS idx_external_data_sources_country ON external_data_sources(country_code);
