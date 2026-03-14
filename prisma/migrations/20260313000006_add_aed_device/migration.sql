-- CreateTable: AedDevice - Physical defibrillator device information
-- Relationship: Aed 1:N AedDevice (one location can have multiple devices over time)
-- Only one device should be is_current = true per Aed at any time

CREATE TABLE IF NOT EXISTS "aed_devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aed_id" UUID NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serial_number" TEXT,
    "manufacturing_date" TIMESTAMP(3),
    "installation_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "warranty_end_date" TIMESTAMP(3),
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aed_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "aed_devices_aed_id_is_current_idx" ON "aed_devices"("aed_id", "is_current");
CREATE INDEX IF NOT EXISTS "aed_devices_serial_number_idx" ON "aed_devices"("serial_number");

-- AddForeignKey
ALTER TABLE "aed_devices" ADD CONSTRAINT "aed_devices_aed_id_fkey"
    FOREIGN KEY ("aed_id") REFERENCES "aeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
