-- Add nominatim_verified_at to track which records have been verified via Nominatim
-- This allows the enrichment script to skip already-verified records on re-runs
ALTER TABLE "aed_locations" ADD COLUMN IF NOT EXISTS "nominatim_verified_at" TIMESTAMPTZ;
