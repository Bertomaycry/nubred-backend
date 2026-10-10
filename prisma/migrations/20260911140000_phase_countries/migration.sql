-- AlterTable
ALTER TABLE "phases" ADD COLUMN IF NOT EXISTS "countries" JSONB;
