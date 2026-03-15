-- AlterTable: AedDevice — add last_maintenance_date and is_mobile
-- last_maintenance_date: tracks when device was last inspected/maintained
-- is_mobile: marks devices in ambulances/vehicles that may not be at fixed location

ALTER TABLE "aed_devices" ADD COLUMN IF NOT EXISTS "last_maintenance_date" TIMESTAMP(3);
ALTER TABLE "aed_devices" ADD COLUMN IF NOT EXISTS "is_mobile" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: AedSchedule — add is_pmr_accessible
-- Whether the AED location is accessible for persons with reduced mobility (PMR)
-- Imported as boolean Sí/No from external sources (e.g., Málaga "accesopmr", France "c_acc_acc")

ALTER TABLE "aed_schedules" ADD COLUMN IF NOT EXISTS "is_pmr_accessible" BOOLEAN;
