-- AlterEnum
ALTER TYPE "AedStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "aeds" ADD COLUMN     "rejection_reason" TEXT;
