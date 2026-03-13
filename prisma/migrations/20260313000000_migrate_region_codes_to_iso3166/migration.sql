-- Migrate region_code values from custom codes to ISO 3166-2 standard
-- Format: {country}-{subdivision} (e.g. ES-MD for Madrid, ES-CT for Cataluña)

-- ============================================
-- external_data_sources: migrate region_code
-- ============================================
UPDATE external_data_sources SET region_code = 'ES-AN' WHERE region_code = 'AND' AND country_code = 'ES';
UPDATE external_data_sources SET region_code = 'ES-AR' WHERE region_code = 'ARA' AND country_code = 'ES';
UPDATE external_data_sources SET region_code = 'ES-AS' WHERE region_code = 'AST' AND country_code = 'ES';
UPDATE external_data_sources SET region_code = 'ES-IB' WHERE region_code = 'BAL' AND country_code = 'ES';
UPDATE external_data_sources SET region_code = 'ES-CN' WHERE region_code = 'CAN' AND country_code = 'ES';
UPDATE external_data_sources SET region_code = 'ES-CB' WHERE region_code = 'CNT' AND country_code = 'ES';
UPDATE external_data_sources SET region_code = 'ES-CL' WHERE region_code = 'CYL' AND country_code = 'ES';
UPDATE external_data_sources SET region_code = 'ES-CM' WHERE region_code = 'CLM' AND country_code = 'ES';
UPDATE external_data_sources SET region_code = 'ES-CT' WHERE region_code = 'CAT' AND country_code = 'ES';
UPDATE external_data_sources SET region_code = 'ES-CE' WHERE region_code = 'CEU' AND country_code = 'ES';
UPDATE external_data_sources SET region_code = 'ES-EX' WHERE region_code = 'EXT' AND country_code = 'ES';
UPDATE external_data_sources SET region_code = 'ES-GA' WHERE region_code = 'GAL' AND country_code = 'ES';
UPDATE external_data_sources SET region_code = 'ES-MD' WHERE region_code = 'MAD' AND country_code = 'ES';
UPDATE external_data_sources SET region_code = 'ES-ML' WHERE region_code = 'MEL' AND country_code = 'ES';
UPDATE external_data_sources SET region_code = 'ES-MC' WHERE region_code = 'MUR' AND country_code = 'ES';
UPDATE external_data_sources SET region_code = 'ES-NC' WHERE region_code = 'NAV' AND country_code = 'ES';
UPDATE external_data_sources SET region_code = 'ES-PV' WHERE region_code = 'PVA' AND country_code = 'ES';
UPDATE external_data_sources SET region_code = 'ES-RI' WHERE region_code = 'RIO' AND country_code = 'ES';
UPDATE external_data_sources SET region_code = 'ES-VC' WHERE region_code = 'VAL' AND country_code = 'ES';
UPDATE external_data_sources SET region_code = 'ES' WHERE region_code = 'ESP' AND country_code = 'ES';
