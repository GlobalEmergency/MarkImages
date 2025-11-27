-- AlterTable: Make AED fields optional
ALTER TABLE "aeds" ALTER COLUMN "code" DROP NOT NULL;
ALTER TABLE "aeds" ALTER COLUMN "establishment_type" DROP NOT NULL;
ALTER TABLE "aeds" ALTER COLUMN "latitude" DROP NOT NULL;
ALTER TABLE "aeds" ALTER COLUMN "longitude" DROP NOT NULL;
ALTER TABLE "aeds" ALTER COLUMN "responsible_id" DROP NOT NULL;

-- AlterTable: Make AedLocation fields optional
ALTER TABLE "aed_locations" ALTER COLUMN "street_type" DROP NOT NULL;
ALTER TABLE "aed_locations" ALTER COLUMN "street_name" DROP NOT NULL;
ALTER TABLE "aed_locations" ALTER COLUMN "postal_code" DROP NOT NULL;
ALTER TABLE "aed_locations" ALTER COLUMN "latitude" DROP NOT NULL;
ALTER TABLE "aed_locations" ALTER COLUMN "longitude" DROP NOT NULL;
ALTER TABLE "aed_locations" ALTER COLUMN "district_id" DROP NOT NULL;

-- AlterTable: Make AedResponsible fields optional and remove unique constraint on email
DROP INDEX IF EXISTS "aed_responsibles_email_key";
ALTER TABLE "aed_responsibles" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "aed_responsibles" ALTER COLUMN "ownership" DROP NOT NULL;
ALTER TABLE "aed_responsibles" ALTER COLUMN "local_ownership" DROP NOT NULL;
ALTER TABLE "aed_responsibles" ALTER COLUMN "local_use" DROP NOT NULL;
