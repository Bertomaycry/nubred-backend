-- CreateEnum
CREATE TYPE "SectionLifecycleStatus" AS ENUM ('NOT_STARTED', 'EXTRACTING', 'TO_REVIEW', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "FieldValueStatus" AS ENUM ('FOUND', 'NOT_FOUND', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "FieldConfidenceLevel" AS ENUM ('CONFIRMED', 'PROVISIONAL', 'CONFLICTING');

-- CreateEnum
CREATE TYPE "FieldReviewState" AS ENUM ('PENDING', 'ACCEPTED', 'GAP', 'EDITED');

-- CreateEnum
CREATE TYPE "CandidateTag" AS ENUM ('NEW', 'UPDATE', 'CONFLICT', 'GAP_CLOSED', 'CHATBOT');

-- CreateEnum
CREATE TYPE "CandidateState" AS ENUM ('OPEN', 'CHOSEN', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RecordOrigin" AS ENUM ('AI', 'VM');

-- CreateEnum
CREATE TYPE "ExtractionStepStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- DropForeignKey
ALTER TABLE "chronology_events" DROP CONSTRAINT "chronology_events_projectId_fkey";

-- DropForeignKey
ALTER TABLE "contract_clauses" DROP CONSTRAINT "contract_clauses_contractId_fkey";

-- DropForeignKey
ALTER TABLE "contract_parties" DROP CONSTRAINT "contract_parties_contractId_fkey";

-- DropForeignKey
ALTER TABLE "evidence_items" DROP CONSTRAINT "evidence_items_sectionExtractionId_fkey";

-- DropForeignKey
ALTER TABLE "field_observer_assignments" DROP CONSTRAINT "field_observer_assignments_genotypeId_fkey";

-- DropForeignKey
ALTER TABLE "field_observer_assignments" DROP CONSTRAINT "field_observer_assignments_protocolId_fkey";

-- DropForeignKey
ALTER TABLE "genotypes" DROP CONSTRAINT "genotypes_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ip_patents" DROP CONSTRAINT "ip_patents_ipRightId_fkey";

-- DropForeignKey
ALTER TABLE "ip_pbrs" DROP CONSTRAINT "ip_pbrs_ipRightId_fkey";

-- DropForeignKey
ALTER TABLE "ip_rights" DROP CONSTRAINT "ip_rights_genotypeId_fkey";

-- DropForeignKey
ALTER TABLE "ip_rights" DROP CONSTRAINT "ip_rights_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ip_trademarks" DROP CONSTRAINT "ip_trademarks_ipRightId_fkey";

-- DropForeignKey
ALTER TABLE "phase_genotypes" DROP CONSTRAINT "phase_genotypes_genotypeId_fkey";

-- DropForeignKey
ALTER TABLE "phase_genotypes" DROP CONSTRAINT "phase_genotypes_phaseId_fkey";

-- DropForeignKey
ALTER TABLE "phases" DROP CONSTRAINT "phases_projectId_fkey";

-- DropForeignKey
ALTER TABLE "project_contracts" DROP CONSTRAINT "project_contracts_documentId_fkey";

-- DropForeignKey
ALTER TABLE "project_contracts" DROP CONSTRAINT "project_contracts_projectId_fkey";

-- DropForeignKey
ALTER TABLE "project_overviews" DROP CONSTRAINT "project_overviews_projectId_fkey";

-- DropForeignKey
ALTER TABLE "protocol_parameters" DROP CONSTRAINT "protocol_parameters_protocolId_fkey";

-- DropForeignKey
ALTER TABLE "protocols" DROP CONSTRAINT "protocols_phaseId_fkey";

-- DropForeignKey
ALTER TABLE "protocols" DROP CONSTRAINT "protocols_projectId_fkey";

-- DropForeignKey
ALTER TABLE "protocols" DROP CONSTRAINT "protocols_speciesId_fkey";

-- DropForeignKey
ALTER TABLE "quarantines" DROP CONSTRAINT "quarantines_genotypeId_fkey";

-- DropForeignKey
ALTER TABLE "quarantines" DROP CONSTRAINT "quarantines_projectId_fkey";

-- DropForeignKey
ALTER TABLE "section_confirmations" DROP CONSTRAINT "section_confirmations_projectId_fkey";

-- DropForeignKey
ALTER TABLE "section_extractions" DROP CONSTRAINT "section_extractions_extractionRunId_fkey";

-- DropForeignKey
ALTER TABLE "section_extractions" DROP CONSTRAINT "section_extractions_projectId_fkey";

-- DropForeignKey
ALTER TABLE "supply_chain_actors" DROP CONSTRAINT "supply_chain_actors_projectId_fkey";

-- DropForeignKey
ALTER TABLE "supply_chain_edges" DROP CONSTRAINT "supply_chain_edges_contractId_fkey";

-- DropForeignKey
ALTER TABLE "supply_chain_edges" DROP CONSTRAINT "supply_chain_edges_fromActorId_fkey";

-- DropForeignKey
ALTER TABLE "supply_chain_edges" DROP CONSTRAINT "supply_chain_edges_projectId_fkey";

-- DropForeignKey
ALTER TABLE "supply_chain_edges" DROP CONSTRAINT "supply_chain_edges_toActorId_fkey";

-- DropForeignKey
ALTER TABLE "todo_tasks" DROP CONSTRAINT "todo_tasks_projectId_fkey";

-- DropIndex
DROP INDEX "evidence_items_projectId_sectionKey_fieldPath_idx";

-- DropIndex
DROP INDEX "field_observer_assignments_genotypeId_farmId_idx";

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "detectedType" TEXT,
ADD COLUMN     "documentDate" TEXT,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "relatedContractRecordId" TEXT,
ADD COLUMN     "relevantSections" JSONB,
ADD COLUMN     "signed" BOOLEAN,
ADD COLUMN     "triagedAt" TIMESTAMP(3);

-- v1 rows point at tables this migration drops. They cannot be mapped onto the field store.
DELETE FROM "evidence_items";
DELETE FROM "field_observer_assignments";

-- AlterTable
ALTER TABLE "evidence_items" DROP COLUMN "fieldPath",
DROP COLUMN "frameworkElement",
DROP COLUMN "sectionExtractionId",
ADD COLUMN     "candidateId" TEXT,
ADD COLUMN     "fieldKey" TEXT NOT NULL,
ADD COLUMN     "recordId" TEXT,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "extraction_runs" ADD COLUMN     "currentDocumentId" TEXT,
ADD COLUMN     "currentSectionKey" TEXT,
ADD COLUMN     "documentIds" JSONB,
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'full',
ADD COLUMN     "stepsDone" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stepsTotal" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "field_observer_assignments" DROP COLUMN "genotypeId",
DROP COLUMN "protocolId",
ADD COLUMN     "genotypeRecordId" TEXT NOT NULL,
ADD COLUMN     "protocolRecordId" TEXT;

-- AlterTable
ALTER TABLE "field_overrides" ADD COLUMN     "fieldKey" TEXT,
ADD COLUMN     "recordId" TEXT;

-- DropTable
DROP TABLE "chronology_events";

-- DropTable
DROP TABLE "contract_clauses";

-- DropTable
DROP TABLE "contract_parties";

-- DropTable
DROP TABLE "genotypes";

-- DropTable
DROP TABLE "ip_patents";

-- DropTable
DROP TABLE "ip_pbrs";

-- DropTable
DROP TABLE "ip_rights";

-- DropTable
DROP TABLE "ip_trademarks";

-- DropTable
DROP TABLE "phase_genotypes";

-- DropTable
DROP TABLE "phases";

-- DropTable
DROP TABLE "project_contracts";

-- DropTable
DROP TABLE "project_overviews";

-- DropTable
DROP TABLE "protocol_parameters";

-- DropTable
DROP TABLE "protocols";

-- DropTable
DROP TABLE "quarantines";

-- DropTable
DROP TABLE "section_confirmations";

-- DropTable
DROP TABLE "section_extractions";

-- DropTable
DROP TABLE "supply_chain_actors";

-- DropTable
DROP TABLE "supply_chain_edges";

-- DropTable
DROP TABLE "todo_tasks";

-- CreateTable
CREATE TABLE "extraction_steps" (
    "id" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT,
    "sectionKey" TEXT NOT NULL,
    "partIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "ExtractionStepStatus" NOT NULL DEFAULT 'QUEUED',
    "skipReason" TEXT,
    "masterFilterIds" JSONB,
    "masterHash" TEXT,
    "userFilterVersion" INTEGER,
    "modelId" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "durationMs" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extraction_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_states" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "status" "SectionLifecycleStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "upstreamChangedAt" TIMESTAMP(3),
    "lastRunId" TEXT,
    "reviewState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "section_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_records" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "groupPath" TEXT NOT NULL,
    "parentRecordId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "origin" "RecordOrigin" NOT NULL DEFAULT 'AI',
    "tag" "CandidateTag",
    "sourceContractRecordIds" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "section_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_values" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "value" JSONB,
    "status" "FieldValueStatus" NOT NULL DEFAULT 'NOT_FOUND',
    "confidence" "FieldConfidenceLevel" NOT NULL DEFAULT 'PROVISIONAL',
    "review" "FieldReviewState" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_candidates" (
    "id" TEXT NOT NULL,
    "fieldValueId" TEXT NOT NULL,
    "runStepId" TEXT,
    "value" JSONB,
    "confidence" "FieldConfidenceLevel" NOT NULL DEFAULT 'PROVISIONAL',
    "tag" "CandidateTag" NOT NULL DEFAULT 'NEW',
    "state" "CandidateState" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_section_filters" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT,
    "storageKey" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_section_filters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extraction_steps_extractionRunId_sectionKey_idx" ON "extraction_steps"("extractionRunId", "sectionKey");

-- CreateIndex
CREATE INDEX "extraction_steps_projectId_documentId_idx" ON "extraction_steps"("projectId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "section_states_projectId_sectionKey_key" ON "section_states"("projectId", "sectionKey");

-- CreateIndex
CREATE INDEX "section_records_projectId_sectionKey_groupPath_idx" ON "section_records"("projectId", "sectionKey", "groupPath");

-- CreateIndex
CREATE INDEX "section_records_parentRecordId_idx" ON "section_records"("parentRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "field_values_recordId_fieldKey_key" ON "field_values"("recordId", "fieldKey");

-- CreateIndex
CREATE INDEX "field_candidates_fieldValueId_state_idx" ON "field_candidates"("fieldValueId", "state");

-- CreateIndex
CREATE INDEX "project_section_filters_projectId_sectionKey_idx" ON "project_section_filters"("projectId", "sectionKey");

-- CreateIndex
CREATE UNIQUE INDEX "project_section_filters_projectId_sectionKey_version_key" ON "project_section_filters"("projectId", "sectionKey", "version");

-- CreateIndex
CREATE INDEX "evidence_items_projectId_sectionKey_fieldKey_idx" ON "evidence_items"("projectId", "sectionKey", "fieldKey");

-- CreateIndex
CREATE INDEX "evidence_items_candidateId_idx" ON "evidence_items"("candidateId");

-- CreateIndex
CREATE INDEX "field_observer_assignments_genotypeRecordId_farmId_idx" ON "field_observer_assignments"("genotypeRecordId", "farmId");

-- AddForeignKey
ALTER TABLE "extraction_steps" ADD CONSTRAINT "extraction_steps_extractionRunId_fkey" FOREIGN KEY ("extractionRunId") REFERENCES "extraction_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_steps" ADD CONSTRAINT "extraction_steps_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_steps" ADD CONSTRAINT "extraction_steps_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "field_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "section_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_states" ADD CONSTRAINT "section_states_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_records" ADD CONSTRAINT "section_records_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_records" ADD CONSTRAINT "section_records_parentRecordId_fkey" FOREIGN KEY ("parentRecordId") REFERENCES "section_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_values" ADD CONSTRAINT "field_values_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "section_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_candidates" ADD CONSTRAINT "field_candidates_fieldValueId_fkey" FOREIGN KEY ("fieldValueId") REFERENCES "field_values"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_candidates" ADD CONSTRAINT "field_candidates_runStepId_fkey" FOREIGN KEY ("runStepId") REFERENCES "extraction_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_section_filters" ADD CONSTRAINT "project_section_filters_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
