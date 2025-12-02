/*
  Warnings:

  - The values [VERIFIED,SUSPENDED,ARCHIVED] on the enum `AedStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `official_district_id` on the `aed_address_validations` table. All the data in the column will be lost.
  - You are about to drop the column `official_neighborhood_id` on the `aed_address_validations` table. All the data in the column will be lost.
  - You are about to drop the column `official_street_id` on the `aed_address_validations` table. All the data in the column will be lost.
  - You are about to drop the column `district_id` on the `aed_locations` table. All the data in the column will be lost.
  - You are about to drop the column `neighborhood_id` on the `aed_locations` table. All the data in the column will be lost.
  - You are about to drop the column `street_id` on the `aed_locations` table. All the data in the column will be lost.
  - You are about to drop the `addresses` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `districts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `neighborhoods` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `street_number_ranges` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `streets` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AedStatus_new" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'INACTIVE');
ALTER TABLE "public"."aeds" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "aeds" ALTER COLUMN "status" TYPE "AedStatus_new" USING ("status"::text::"AedStatus_new");
ALTER TABLE "aed_status_changes" ALTER COLUMN "previous_status" TYPE "AedStatus_new" USING ("previous_status"::text::"AedStatus_new");
ALTER TABLE "aed_status_changes" ALTER COLUMN "new_status" TYPE "AedStatus_new" USING ("new_status"::text::"AedStatus_new");
ALTER TYPE "AedStatus" RENAME TO "AedStatus_old";
ALTER TYPE "AedStatus_new" RENAME TO "AedStatus";
DROP TYPE "public"."AedStatus_old";
ALTER TABLE "aeds" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- DropForeignKey
ALTER TABLE "addresses" DROP CONSTRAINT "addresses_district_id_fkey";

-- DropForeignKey
ALTER TABLE "addresses" DROP CONSTRAINT "addresses_neighborhood_id_fkey";

-- DropForeignKey
ALTER TABLE "addresses" DROP CONSTRAINT "addresses_street_id_fkey";

-- DropForeignKey
ALTER TABLE "aed_locations" DROP CONSTRAINT "aed_locations_district_id_fkey";

-- DropForeignKey
ALTER TABLE "aed_locations" DROP CONSTRAINT "aed_locations_neighborhood_id_fkey";

-- DropForeignKey
ALTER TABLE "aed_locations" DROP CONSTRAINT "aed_locations_street_id_fkey";

-- DropForeignKey
ALTER TABLE "aeds" DROP CONSTRAINT "aeds_responsible_id_fkey";

-- DropForeignKey
ALTER TABLE "neighborhoods" DROP CONSTRAINT "neighborhoods_district_id_fkey";

-- DropForeignKey
ALTER TABLE "street_number_ranges" DROP CONSTRAINT "street_number_ranges_district_id_fkey";

-- DropForeignKey
ALTER TABLE "street_number_ranges" DROP CONSTRAINT "street_number_ranges_neighborhood_id_fkey";

-- DropForeignKey
ALTER TABLE "street_number_ranges" DROP CONSTRAINT "street_number_ranges_street_id_fkey";

-- DropIndex
DROP INDEX "aed_locations_district_id_neighborhood_id_idx";

-- DropIndex
DROP INDEX "aed_locations_street_id_idx";

-- DropIndex
DROP INDEX "aed_responsibles_email_idx";

-- DropIndex
DROP INDEX "idx_aeds_geom";

-- AlterTable
ALTER TABLE "aed_address_validations" DROP COLUMN "official_district_id",
DROP COLUMN "official_neighborhood_id",
DROP COLUMN "official_street_id",
ADD COLUMN     "official_city_code" TEXT,
ADD COLUMN     "official_city_name" TEXT,
ADD COLUMN     "official_district_code" TEXT,
ADD COLUMN     "official_district_name" TEXT,
ADD COLUMN     "official_neighborhood_code" TEXT,
ADD COLUMN     "official_neighborhood_name" TEXT,
ADD COLUMN     "official_street_name" TEXT;

-- AlterTable
ALTER TABLE "aed_locations" DROP COLUMN "district_id",
DROP COLUMN "neighborhood_id",
DROP COLUMN "street_id",
ADD COLUMN     "city_code" TEXT,
ADD COLUMN     "city_name" TEXT,
ADD COLUMN     "district_code" TEXT,
ADD COLUMN     "district_name" TEXT,
ADD COLUMN     "neighborhood_code" TEXT,
ADD COLUMN     "neighborhood_name" TEXT;

-- AlterTable
ALTER TABLE "aeds" ADD COLUMN     "status_metadata" JSONB;

-- DropTable
DROP TABLE "addresses";

-- DropTable
DROP TABLE "districts";

-- DropTable
DROP TABLE "neighborhoods";

-- DropTable
DROP TABLE "street_number_ranges";

-- DropTable
DROP TABLE "streets";

-- CreateIndex
CREATE INDEX "aed_locations_city_code_district_code_idx" ON "aed_locations"("city_code", "district_code");

-- AddForeignKey
ALTER TABLE "aeds" ADD CONSTRAINT "aeds_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "aed_responsibles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
