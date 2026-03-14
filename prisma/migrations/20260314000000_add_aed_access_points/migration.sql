-- CreateEnum
CREATE TYPE "access_point_type" AS ENUM ('PEDESTRIAN', 'VEHICLE', 'EMERGENCY', 'WHEELCHAIR', 'UNIVERSAL');

-- CreateEnum
CREATE TYPE "access_restriction_type" AS ENUM ('NONE', 'CODE', 'KEY', 'CARD', 'INTERCOM', 'SECURITY_GUARD', 'LOCKED_HOURS');

-- CreateTable
CREATE TABLE IF NOT EXISTS "aed_access_points" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aed_id" UUID NOT NULL,

    -- Location
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,

    -- Classification
    "type" "access_point_type" NOT NULL,
    "label" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    -- Access restrictions
    "restriction_type" "access_restriction_type" NOT NULL DEFAULT 'NONE',
    "unlock_code" TEXT,
    "contact_phone" TEXT,
    "contact_name" TEXT,

    -- Availability
    "available_24h" BOOLEAN NOT NULL DEFAULT true,
    "schedule_notes" TEXT,

    -- Indoor route
    "floor_difference" INTEGER,
    "has_elevator" BOOLEAN,
    "estimated_minutes" INTEGER,
    "indoor_steps" JSONB,

    -- Emergency
    "emergency_phone" TEXT,
    "can_deliver_to_entrance" BOOLEAN NOT NULL DEFAULT false,

    -- Traceability
    "created_by" UUID NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "aed_access_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "aed_access_points_aed_id_idx" ON "aed_access_points"("aed_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "aed_access_points_latitude_longitude_idx" ON "aed_access_points"("latitude", "longitude");

-- AddForeignKey
ALTER TABLE "aed_access_points"
    ADD CONSTRAINT "aed_access_points_aed_id_fkey"
    FOREIGN KEY ("aed_id") REFERENCES "aeds"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add access_point_id to aed_images
ALTER TABLE "aed_images" ADD COLUMN IF NOT EXISTS "access_point_id" UUID;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "aed_images_access_point_id_idx" ON "aed_images"("access_point_id");

-- AddForeignKey
ALTER TABLE "aed_images"
    ADD CONSTRAINT "aed_images_access_point_id_fkey"
    FOREIGN KEY ("access_point_id") REFERENCES "aed_access_points"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
