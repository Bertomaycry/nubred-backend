-- CreateEnum
CREATE TYPE "EarlyAdopterApp" AS ENUM ('governance', 'node');

-- AlterTable
ALTER TABLE "early_adopters" ADD COLUMN "app" "EarlyAdopterApp" NOT NULL DEFAULT 'governance';

-- DropIndex
DROP INDEX "early_adopters_email_key";

-- CreateIndex
CREATE UNIQUE INDEX "early_adopters_email_app_key" ON "early_adopters"("email", "app");

-- CreateIndex
CREATE INDEX "early_adopters_app_idx" ON "early_adopters"("app");
