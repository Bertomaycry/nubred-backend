-- data-loss-approved
-- Client module: the project module moves to one database per client (see prisma/tenant).
-- Existing tenants, jobs and project tables only held development test data.
DELETE FROM "jobs";
DELETE FROM "tenants";

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "ProvisioningStatus" AS ENUM ('provisioning', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "TenantUserRole" AS ENUM ('owner', 'master_project_manager', 'project_manager', 'field_observer', 'viewer');

-- CreateEnum
CREATE TYPE "RestrictionAction" AS ENUM ('restrict', 'reactivate');

-- CreateEnum
CREATE TYPE "RestrictionReason" AS ENUM ('security_violation', 'client_stop_paying');

-- DropForeignKey
ALTER TABLE "tenant_members" DROP CONSTRAINT "tenant_members_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_members" DROP CONSTRAINT "tenant_members_userId_fkey";

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_createdById_fkey";

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_speciesId_fkey";

-- DropForeignKey
ALTER TABLE "project_members" DROP CONSTRAINT "project_members_projectId_fkey";

-- DropForeignKey
ALTER TABLE "project_members" DROP CONSTRAINT "project_members_userId_fkey";

-- DropForeignKey
ALTER TABLE "project_members" DROP CONSTRAINT "project_members_invitedById_fkey";

-- DropForeignKey
ALTER TABLE "farms" DROP CONSTRAINT "farms_projectId_fkey";

-- DropForeignKey
ALTER TABLE "plots" DROP CONSTRAINT "plots_farmId_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_projectId_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "document_pages" DROP CONSTRAINT "document_pages_documentId_fkey";

-- DropForeignKey
ALTER TABLE "extraction_runs" DROP CONSTRAINT "extraction_runs_projectId_fkey";

-- DropForeignKey
ALTER TABLE "section_extractions" DROP CONSTRAINT "section_extractions_extractionRunId_fkey";

-- DropForeignKey
ALTER TABLE "section_extractions" DROP CONSTRAINT "section_extractions_projectId_fkey";

-- DropForeignKey
ALTER TABLE "evidence_items" DROP CONSTRAINT "evidence_items_projectId_fkey";

-- DropForeignKey
ALTER TABLE "evidence_items" DROP CONSTRAINT "evidence_items_sectionExtractionId_fkey";

-- DropForeignKey
ALTER TABLE "evidence_items" DROP CONSTRAINT "evidence_items_documentId_fkey";

-- DropForeignKey
ALTER TABLE "field_overrides" DROP CONSTRAINT "field_overrides_projectId_fkey";

-- DropForeignKey
ALTER TABLE "field_overrides" DROP CONSTRAINT "field_overrides_overriddenById_fkey";

-- DropForeignKey
ALTER TABLE "section_confirmations" DROP CONSTRAINT "section_confirmations_projectId_fkey";

-- DropForeignKey
ALTER TABLE "section_confirmations" DROP CONSTRAINT "section_confirmations_confirmedById_fkey";

-- DropForeignKey
ALTER TABLE "project_contracts" DROP CONSTRAINT "project_contracts_projectId_fkey";

-- DropForeignKey
ALTER TABLE "project_contracts" DROP CONSTRAINT "project_contracts_documentId_fkey";

-- DropForeignKey
ALTER TABLE "contract_parties" DROP CONSTRAINT "contract_parties_contractId_fkey";

-- DropForeignKey
ALTER TABLE "contract_clauses" DROP CONSTRAINT "contract_clauses_contractId_fkey";

-- DropForeignKey
ALTER TABLE "genotypes" DROP CONSTRAINT "genotypes_projectId_fkey";

-- DropForeignKey
ALTER TABLE "phases" DROP CONSTRAINT "phases_projectId_fkey";

-- DropForeignKey
ALTER TABLE "phase_genotypes" DROP CONSTRAINT "phase_genotypes_phaseId_fkey";

-- DropForeignKey
ALTER TABLE "phase_genotypes" DROP CONSTRAINT "phase_genotypes_genotypeId_fkey";

-- DropForeignKey
ALTER TABLE "protocols" DROP CONSTRAINT "protocols_projectId_fkey";

-- DropForeignKey
ALTER TABLE "protocols" DROP CONSTRAINT "protocols_phaseId_fkey";

-- DropForeignKey
ALTER TABLE "protocols" DROP CONSTRAINT "protocols_speciesId_fkey";

-- DropForeignKey
ALTER TABLE "protocol_parameters" DROP CONSTRAINT "protocol_parameters_protocolId_fkey";

-- DropForeignKey
ALTER TABLE "chronology_events" DROP CONSTRAINT "chronology_events_projectId_fkey";

-- DropForeignKey
ALTER TABLE "parameter_definitions" DROP CONSTRAINT "parameter_definitions_speciesId_fkey";

-- DropForeignKey
ALTER TABLE "field_observer_assignments" DROP CONSTRAINT "field_observer_assignments_projectId_fkey";

-- DropForeignKey
ALTER TABLE "field_observer_assignments" DROP CONSTRAINT "field_observer_assignments_userId_fkey";

-- DropForeignKey
ALTER TABLE "field_observer_assignments" DROP CONSTRAINT "field_observer_assignments_assignedById_fkey";

-- DropForeignKey
ALTER TABLE "field_observer_assignments" DROP CONSTRAINT "field_observer_assignments_genotypeId_fkey";

-- DropForeignKey
ALTER TABLE "field_observer_assignments" DROP CONSTRAINT "field_observer_assignments_farmId_fkey";

-- DropForeignKey
ALTER TABLE "field_observer_assignments" DROP CONSTRAINT "field_observer_assignments_plotId_fkey";

-- DropForeignKey
ALTER TABLE "field_observer_assignments" DROP CONSTRAINT "field_observer_assignments_protocolId_fkey";

-- DropForeignKey
ALTER TABLE "project_overviews" DROP CONSTRAINT "project_overviews_projectId_fkey";

-- DropForeignKey
ALTER TABLE "supply_chain_actors" DROP CONSTRAINT "supply_chain_actors_projectId_fkey";

-- DropForeignKey
ALTER TABLE "supply_chain_edges" DROP CONSTRAINT "supply_chain_edges_projectId_fkey";

-- DropForeignKey
ALTER TABLE "supply_chain_edges" DROP CONSTRAINT "supply_chain_edges_fromActorId_fkey";

-- DropForeignKey
ALTER TABLE "supply_chain_edges" DROP CONSTRAINT "supply_chain_edges_toActorId_fkey";

-- DropForeignKey
ALTER TABLE "supply_chain_edges" DROP CONSTRAINT "supply_chain_edges_contractId_fkey";

-- DropForeignKey
ALTER TABLE "ip_rights" DROP CONSTRAINT "ip_rights_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ip_rights" DROP CONSTRAINT "ip_rights_genotypeId_fkey";

-- DropForeignKey
ALTER TABLE "ip_pbrs" DROP CONSTRAINT "ip_pbrs_ipRightId_fkey";

-- DropForeignKey
ALTER TABLE "ip_patents" DROP CONSTRAINT "ip_patents_ipRightId_fkey";

-- DropForeignKey
ALTER TABLE "ip_trademarks" DROP CONSTRAINT "ip_trademarks_ipRightId_fkey";

-- DropForeignKey
ALTER TABLE "todo_tasks" DROP CONSTRAINT "todo_tasks_projectId_fkey";

-- DropForeignKey
ALTER TABLE "todo_tasks" DROP CONSTRAINT "todo_tasks_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "quarantines" DROP CONSTRAINT "quarantines_projectId_fkey";

-- DropForeignKey
ALTER TABLE "quarantines" DROP CONSTRAINT "quarantines_genotypeId_fkey";

-- DropForeignKey
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_projectId_fkey";

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "bucketName" TEXT NOT NULL,
ADD COLUMN     "databaseName" TEXT NOT NULL,
ADD COLUMN     "maxProjects" INTEGER NOT NULL,
ADD COLUMN     "provisioningStatus" "ProvisioningStatus" NOT NULL DEFAULT 'provisioning',
ADD COLUMN     "status" "TenantStatus" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "jobs" ALTER COLUMN "tenantId" SET NOT NULL;

-- DropTable
DROP TABLE "tenant_members";

-- DropTable
DROP TABLE "projects";

-- DropTable
DROP TABLE "project_members";

-- DropTable
DROP TABLE "farms";

-- DropTable
DROP TABLE "plots";

-- DropTable
DROP TABLE "documents";

-- DropTable
DROP TABLE "document_pages";

-- DropTable
DROP TABLE "extraction_runs";

-- DropTable
DROP TABLE "section_extractions";

-- DropTable
DROP TABLE "evidence_items";

-- DropTable
DROP TABLE "field_overrides";

-- DropTable
DROP TABLE "section_confirmations";

-- DropTable
DROP TABLE "project_contracts";

-- DropTable
DROP TABLE "contract_parties";

-- DropTable
DROP TABLE "contract_clauses";

-- DropTable
DROP TABLE "genotypes";

-- DropTable
DROP TABLE "phases";

-- DropTable
DROP TABLE "phase_genotypes";

-- DropTable
DROP TABLE "protocols";

-- DropTable
DROP TABLE "protocol_parameters";

-- DropTable
DROP TABLE "chronology_events";

-- DropTable
DROP TABLE "species";

-- DropTable
DROP TABLE "parameter_definitions";

-- DropTable
DROP TABLE "field_observer_assignments";

-- DropTable
DROP TABLE "project_overviews";

-- DropTable
DROP TABLE "supply_chain_actors";

-- DropTable
DROP TABLE "supply_chain_edges";

-- DropTable
DROP TABLE "ip_rights";

-- DropTable
DROP TABLE "ip_pbrs";

-- DropTable
DROP TABLE "ip_patents";

-- DropTable
DROP TABLE "ip_trademarks";

-- DropTable
DROP TABLE "todo_tasks";

-- DropTable
DROP TABLE "quarantines";

-- DropEnum
DROP TYPE "ProjectStatus";

-- DropEnum
DROP TYPE "ProjectRole";

-- DropEnum
DROP TYPE "ActorState";

-- DropEnum
DROP TYPE "DocumentType";

-- DropEnum
DROP TYPE "DocumentStatus";

-- DropEnum
DROP TYPE "DocumentOrigin";

-- DropEnum
DROP TYPE "ExtractionRunStatus";

-- DropEnum
DROP TYPE "SectionExtractionStatus";

-- DropEnum
DROP TYPE "FieldConfidence";

-- DropEnum
DROP TYPE "FieldOverrideSource";

-- DropEnum
DROP TYPE "DevelopmentStatus";

-- DropEnum
DROP TYPE "GenotypeLifecycle";

-- DropEnum
DROP TYPE "PhaseType";

-- DropEnum
DROP TYPE "PhaseCategory";

-- DropEnum
DROP TYPE "GenotypeDecision";

-- DropEnum
DROP TYPE "ProtocolType";

-- DropEnum
DROP TYPE "ParameterFamily";

-- DropEnum
DROP TYPE "ParameterLevel";

-- DropEnum
DROP TYPE "ParameterInputType";

-- DropEnum
DROP TYPE "FrequencyType";

-- DropEnum
DROP TYPE "ScalePolarity";

-- DropEnum
DROP TYPE "EliminatoryLevel";

-- DropEnum
DROP TYPE "ChronologyEventType";

-- DropEnum
DROP TYPE "DatePrecision";

-- DropEnum
DROP TYPE "ContractFamily";

-- DropEnum
DROP TYPE "PartyRole";

-- DropEnum
DROP TYPE "PbrStatus";

-- DropEnum
DROP TYPE "FlagSeverity";

-- DropEnum
DROP TYPE "FlagType";

-- DropEnum
DROP TYPE "IpRightType";

-- DropEnum
DROP TYPE "TodoTaskCategory";

-- DropEnum
DROP TYPE "QuarantineStatus";

-- CreateTable
CREATE TABLE "tenant_users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "TenantUserRole" NOT NULL,
    "clerkUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_modules" (
    "tenantId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tenant_modules_pkey" PRIMARY KEY ("tenantId","moduleId")
);

-- CreateTable
CREATE TABLE "tenant_restrictions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "action" "RestrictionAction" NOT NULL,
    "reason" "RestrictionReason",
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_usage_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantUserId" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantUserId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "requestId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_users_clerkUserId_idx" ON "tenant_users"("clerkUserId");

-- CreateIndex
CREATE INDEX "tenant_users_email_idx" ON "tenant_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_tenantId_email_key" ON "tenant_users"("tenantId", "email");

-- CreateIndex
CREATE INDEX "tenant_restrictions_tenantId_createdAt_idx" ON "tenant_restrictions"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "time_usage_events_tenantId_recordedAt_idx" ON "time_usage_events"("tenantId", "recordedAt");

-- CreateIndex
CREATE INDEX "time_usage_events_tenantId_tenantUserId_recordedAt_idx" ON "time_usage_events"("tenantId", "tenantUserId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_events_requestId_key" ON "ai_usage_events"("requestId");

-- CreateIndex
CREATE INDEX "ai_usage_events_tenantId_recordedAt_idx" ON "ai_usage_events"("tenantId", "recordedAt");

-- CreateIndex
CREATE INDEX "ai_usage_events_tenantId_tenantUserId_recordedAt_idx" ON "ai_usage_events"("tenantId", "tenantUserId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_databaseName_key" ON "tenants"("databaseName");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_bucketName_key" ON "tenants"("bucketName");

-- CreateIndex
CREATE INDEX "tenants_provisioningStatus_status_idx" ON "tenants"("provisioningStatus", "status");

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_modules" ADD CONSTRAINT "tenant_modules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_restrictions" ADD CONSTRAINT "tenant_restrictions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

