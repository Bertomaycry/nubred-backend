-- CreateEnum
CREATE TYPE "DocumentOrigin" AS ENUM ('UPLOAD', 'CHATBOT');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "origin" "DocumentOrigin" NOT NULL DEFAULT 'UPLOAD';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "sectionKey" TEXT;
