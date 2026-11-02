-- CreateEnum
CREATE TYPE "UserFilterStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "FilterUploadKind" AS ENUM ('MASTER', 'USER');

-- CreateEnum
CREATE TYPE "FilterUploadStatus" AS ENUM ('PENDING_UPLOAD', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "master_filters" (
    "id" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sourceUserFilterId" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_filters" (
    "id" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "UserFilterStatus" NOT NULL DEFAULT 'PENDING',
    "promotedMasterFilterId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filter_uploads" (
    "id" TEXT NOT NULL,
    "kind" "FilterUploadKind" NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "tenantId" TEXT,
    "createdById" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "declaredSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "FilterUploadStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "failureReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filter_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_filters_sourceUserFilterId_key" ON "master_filters"("sourceUserFilterId");

-- CreateIndex
CREATE INDEX "master_filters_sectionKey_createdAt_idx" ON "master_filters"("sectionKey", "createdAt");

-- CreateIndex
CREATE INDEX "user_filters_sectionKey_status_createdAt_idx" ON "user_filters"("sectionKey", "status", "createdAt");

-- CreateIndex
CREATE INDEX "user_filters_tenantId_createdAt_idx" ON "user_filters"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "filter_uploads_status_expiresAt_idx" ON "filter_uploads"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "user_filters" ADD CONSTRAINT "user_filters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
