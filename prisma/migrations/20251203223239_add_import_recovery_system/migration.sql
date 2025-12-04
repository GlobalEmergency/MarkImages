-- CreateEnum
CREATE TYPE "CheckpointStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ImportStatus" ADD VALUE 'INTERRUPTED';
ALTER TYPE "ImportStatus" ADD VALUE 'RESUMING';

-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN     "cancelled_manually" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_checkpoint_index" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_heartbeat" TIMESTAMP(3),
ADD COLUMN     "resumed_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "import_checkpoints" (
    "id" UUID NOT NULL,
    "import_batch_id" UUID NOT NULL,
    "record_index" INTEGER NOT NULL,
    "record_reference" TEXT,
    "record_hash" TEXT,
    "status" "CheckpointStatus" NOT NULL,
    "error_message" TEXT,
    "processing_time_ms" INTEGER,
    "record_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_checkpoints_import_batch_id_status_idx" ON "import_checkpoints"("import_batch_id", "status");

-- CreateIndex
CREATE INDEX "import_checkpoints_record_hash_idx" ON "import_checkpoints"("record_hash");

-- CreateIndex
CREATE UNIQUE INDEX "import_checkpoints_import_batch_id_record_index_key" ON "import_checkpoints"("import_batch_id", "record_index");

-- CreateIndex
CREATE INDEX "import_batches_status_last_heartbeat_idx" ON "import_batches"("status", "last_heartbeat");

-- AddForeignKey
ALTER TABLE "import_checkpoints" ADD CONSTRAINT "import_checkpoints_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
