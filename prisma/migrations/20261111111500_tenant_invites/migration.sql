-- CreateEnum
CREATE TYPE "TenantInviteStatus" AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- CreateTable
CREATE TABLE "tenant_invites" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "TenantUserRole" NOT NULL,
    "clerkInvitationId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "TenantInviteStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_invites_tenantId_email_key" ON "tenant_invites"("tenantId", "email");

-- CreateIndex
CREATE INDEX "tenant_invites_status_expiresAt_idx" ON "tenant_invites"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "tenant_invites_clerkInvitationId_idx" ON "tenant_invites"("clerkInvitationId");

-- AddForeignKey
ALTER TABLE "tenant_invites" ADD CONSTRAINT "tenant_invites_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
