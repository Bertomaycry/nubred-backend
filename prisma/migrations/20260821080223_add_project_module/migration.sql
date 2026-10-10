-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('VARIETY_MANAGER', 'NURSERY', 'GROWER', 'PACKHOUSE_MARKETER');

-- CreateEnum
CREATE TYPE "ActorState" AS ENUM ('ACTIVE', 'PENDING');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('SIGNED_CONTRACT', 'DRAFT_CONTRACT', 'CONTRACT_ANNEX', 'IP_CERTIFICATE', 'EMAIL', 'PROTOCOL_DOCUMENT', 'VCU_EVALUATION', 'PLANTING_PLAN', 'MEETING_NOTES', 'QUALITY_SPECIFICATION', 'SOIL_ANALYSIS', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ExtractionRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "SectionExtractionStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "FieldConfidence" AS ENUM ('CONFIRMED', 'PROVISIONAL', 'CONFLICTING', 'MISSING');

-- CreateEnum
CREATE TYPE "FieldOverrideSource" AS ENUM ('VM_MANUAL', 'CHATBOT');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'DEAD');

-- CreateEnum
CREATE TYPE "DevelopmentStatus" AS ENUM ('SELECTION', 'VARIETY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "GenotypeLifecycle" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PhaseType" AS ENUM ('TRIAL', 'PILOT', 'LAUNCH', 'SCALE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PhaseCategory" AS ENUM ('EXPERIMENTAL', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "GenotypeDecision" AS ENUM ('PROMOTE', 'REPEAT', 'DISCARD');

-- CreateEnum
CREATE TYPE "ProtocolType" AS ENUM ('OBSERVATIONAL', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "ParameterFamily" AS ENUM ('F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8');

-- CreateEnum
CREATE TYPE "ParameterLevel" AS ENUM ('UNIVERSAL', 'SPECIES_STANDARD', 'PROJECT_CUSTOM');

-- CreateEnum
CREATE TYPE "ParameterInputType" AS ENUM ('NUMBER', 'SCALE', 'OPTION', 'DISTRIBUTION', 'DATE', 'BOOLEAN', 'PHOTO', 'TEXT');

-- CreateEnum
CREATE TYPE "FrequencyType" AS ENUM ('CALENDAR_FIXED', 'EVENT_BASED', 'PHASE_GATE', 'ON_DEMAND');

-- CreateEnum
CREATE TYPE "ScalePolarity" AS ENUM ('HIGHER_BETTER', 'LOWER_BETTER');

-- CreateEnum
CREATE TYPE "EliminatoryLevel" AS ENUM ('L1', 'L2', 'L3');

-- CreateEnum
CREATE TYPE "ChronologyEventType" AS ENUM ('CONTRACT_SIGNATURE', 'CONTRACT_AMENDMENT', 'PHASE_ADVANCEMENT', 'PHASE_START', 'PHASE_GATE', 'IP_FILING', 'IP_GRANT', 'IP_EXPIRY', 'QUARANTINE_START', 'QUARANTINE_CERTIFICATION', 'HARVEST_DECLARATION', 'OBSERVATION_MILESTONE', 'MEETING_DECISION', 'EMAIL_EXCHANGE', 'ROYALTY_PAYMENT', 'OPTION_EXERCISE', 'OTHER');

-- CreateEnum
CREATE TYPE "DatePrecision" AS ENUM ('EXACT', 'ESTIMATED', 'INFERRED');

-- CreateEnum
CREATE TYPE "ContractFamily" AS ENUM ('F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14', 'F15', 'F16', 'F17', 'F18', 'F19', 'F20', 'F21', 'F22', 'F23', 'F24', 'UNCLASSIFIED');

-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('BREEDER', 'PRINCIPAL', 'LICENSOR', 'IVM', 'LICENSEE', 'NURSERY', 'LICENSED_GROWER', 'PACKHOUSE', 'MARKETER', 'CONSULTANT', 'LPM', 'CONTRACTOR', 'ASSOCIATION_OF_PRODUCERS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PbrStatus" AS ENUM ('PROTECTED', 'APPLICATION_PENDING', 'NOT_YET_FILED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FlagSeverity" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "FlagType" AS ENUM ('ABSENCE', 'ANOMALY', 'IMBALANCE');

-- CreateEnum
CREATE TYPE "IpRightType" AS ENUM ('PBR', 'PATENT', 'TRADEMARK');

-- CreateEnum
CREATE TYPE "TodoTaskCategory" AS ENUM ('CONTRACT_OBLIGATION', 'PHASE_GATE', 'REPORTING', 'QUARANTINE', 'OTHER');

-- CreateEnum
CREATE TYPE "QuarantineStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'IN_PROGRESS', 'CERTIFIED', 'BLOCKED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_members" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "speciesId" TEXT,
    "primarySpeciesBotanical" TEXT,
    "primarySpeciesCommon" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "invitedEmail" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL,
    "state" "ActorState" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farms" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plots" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "areaHa" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT,
    "storageKey" TEXT NOT NULL,
    "bucket" TEXT,
    "documentType" "DocumentType" NOT NULL DEFAULT 'OTHER',
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "failureReason" TEXT,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_pages" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "charCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_runs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "ExtractionRunStatus" NOT NULL DEFAULT 'QUEUED',
    "promptHash" TEXT,
    "modelId" TEXT,
    "provider" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extraction_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_extractions" (
    "id" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "status" "SectionExtractionStatus" NOT NULL DEFAULT 'QUEUED',
    "promptHash" TEXT,
    "modelId" TEXT,
    "rawResponse" JSONB,
    "payload" JSONB,
    "fieldMeta" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "section_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_items" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sectionExtractionId" TEXT,
    "documentId" TEXT,
    "sectionKey" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "documentName" TEXT NOT NULL,
    "page" INTEGER,
    "charOffset" INTEGER,
    "quote" TEXT NOT NULL,
    "frameworkElement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_overrides" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "source" "FieldOverrideSource" NOT NULL,
    "reason" TEXT,
    "overriddenById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_confirmations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "confirmedById" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadSnapshot" JSONB NOT NULL,
    "reviewState" JSONB,
    "warningsAck" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "section_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_contracts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT,
    "contractType" "ContractFamily",
    "economicFunction" TEXT,
    "classificationConfidence" DOUBLE PRECISION,
    "contractLanguage" TEXT,
    "governingLaw" TEXT,
    "effectiveDate" TEXT,
    "endDate" TEXT,
    "evaluationPeriod" TEXT,
    "renewalMechanism" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_parties" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "name" TEXT,
    "role" "PartyRole",
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_clauses" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "clauseId" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "flagType" "FlagType",
    "severity" "FlagSeverity",
    "note" TEXT,
    "citedSource" TEXT,
    "vmNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_clauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genotypes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT,
    "breederCode" TEXT,
    "speciesBotanical" TEXT,
    "speciesCommon" TEXT,
    "developmentStatus" "DevelopmentStatus",
    "lifecycle" "GenotypeLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "numberOfPlants" INTEGER,
    "ipReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "genotypes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phases" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT,
    "type" "PhaseType",
    "category" "PhaseCategory",
    "typeMappingNote" TEXT,
    "objective" TEXT,
    "duration" TEXT,
    "startTrigger" TEXT,
    "location" TEXT,
    "plantCount" INTEGER,
    "hectares" DOUBLE PRECISION,
    "gateCriteria" JSONB,
    "capitolatoDefined" BOOLEAN,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phase_genotypes" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "genotypeId" TEXT NOT NULL,
    "decision" "GenotypeDecision",
    "decisionDate" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phase_genotypes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocols" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT,
    "speciesId" TEXT,
    "name" TEXT,
    "objective" TEXT,
    "protocolType" "ProtocolType",
    "linkedPhase" "PhaseType",
    "sourceDocument" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocol_parameters" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nubredStandardName" TEXT,
    "family" "ParameterFamily",
    "parameterLevel" "ParameterLevel",
    "inputType" "ParameterInputType",
    "scaleMin" DOUBLE PRECISION,
    "scaleMax" DOUBLE PRECISION,
    "scalePolarity" "ScalePolarity",
    "howToMeasure" TEXT,
    "unit" TEXT,
    "frequencyType" "FrequencyType",
    "frequencyValue" TEXT,
    "dataCollectionWindow" TEXT,
    "sampleSize" TEXT,
    "threshold" TEXT,
    "thresholdType" TEXT,
    "eliminatoryLevel" "EliminatoryLevel",
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "optionValues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "protocol_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chronology_events" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "eventType" "ChronologyEventType" NOT NULL,
    "description" TEXT NOT NULL,
    "date" TEXT,
    "datePrecision" "DatePrecision" NOT NULL,
    "dateNotes" TEXT,
    "actor" TEXT,
    "sourceSection" TEXT,
    "linkedEntityType" TEXT,
    "linkedEntityRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chronology_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "species" (
    "id" TEXT NOT NULL,
    "botanicalName" TEXT NOT NULL,
    "commonName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parameter_definitions" (
    "id" TEXT NOT NULL,
    "speciesId" TEXT,
    "name" TEXT NOT NULL,
    "family" "ParameterFamily" NOT NULL,
    "level" "ParameterLevel" NOT NULL,
    "inputType" "ParameterInputType" NOT NULL,
    "scaleMin" DOUBLE PRECISION,
    "scaleMax" DOUBLE PRECISION,
    "scalePolarity" "ScalePolarity",
    "unit" TEXT,
    "howToMeasure" TEXT,
    "frequencyType" "FrequencyType",
    "threshold" TEXT,
    "thresholdType" TEXT,
    "eliminatoryLevel" "EliminatoryLevel",
    "optionValues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parameter_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_observer_assignments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "genotypeId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "plotId" TEXT,
    "protocolId" TEXT,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_observer_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_overviews" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "summary" TEXT,
    "species" TEXT,
    "territory" TEXT,
    "startDate" TEXT,
    "governanceRating" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_overviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_chain_actors" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "ProjectRole",
    "state" "ActorState",
    "userId" TEXT,
    "invitedEmail" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supply_chain_actors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_chain_edges" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromActorId" TEXT NOT NULL,
    "toActorId" TEXT NOT NULL,
    "contractId" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supply_chain_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ip_rights" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "genotypeId" TEXT,
    "type" "IpRightType" NOT NULL,
    "name" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ip_rights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ip_pbrs" (
    "id" TEXT NOT NULL,
    "ipRightId" TEXT NOT NULL,
    "grantNumber" TEXT,
    "office" TEXT,
    "filingDate" TEXT,
    "grantDate" TEXT,
    "expiryDate" TEXT,
    "status" "PbrStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ip_pbrs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ip_patents" (
    "id" TEXT NOT NULL,
    "ipRightId" TEXT NOT NULL,
    "patentNumber" TEXT,
    "office" TEXT,
    "filingDate" TEXT,
    "grantDate" TEXT,
    "expiryDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ip_patents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ip_trademarks" (
    "id" TEXT NOT NULL,
    "ipRightId" TEXT NOT NULL,
    "registration" TEXT,
    "territory" TEXT,
    "includedInContract" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ip_trademarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todo_tasks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TEXT,
    "category" "TodoTaskCategory" NOT NULL DEFAULT 'OTHER',
    "assignedActorRole" "ProjectRole",
    "assignedToId" TEXT,
    "citedSource" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "todo_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quarantines" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "genotypeId" TEXT,
    "status" "QuarantineStatus" NOT NULL DEFAULT 'PENDING',
    "expectedCertificationDate" TEXT,
    "documentationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quarantines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenant_members_userId_idx" ON "tenant_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_members_tenantId_userId_key" ON "tenant_members"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "projects_tenantId_status_idx" ON "projects"("tenantId", "status");

-- CreateIndex
CREATE INDEX "projects_createdById_idx" ON "projects"("createdById");

-- CreateIndex
CREATE INDEX "project_members_userId_idx" ON "project_members"("userId");

-- CreateIndex
CREATE INDEX "project_members_projectId_role_state_idx" ON "project_members"("projectId", "role", "state");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_projectId_invitedEmail_key" ON "project_members"("projectId", "invitedEmail");

-- CreateIndex
CREATE INDEX "farms_projectId_idx" ON "farms"("projectId");

-- CreateIndex
CREATE INDEX "plots_farmId_idx" ON "plots"("farmId");

-- CreateIndex
CREATE INDEX "documents_projectId_status_idx" ON "documents"("projectId", "status");

-- CreateIndex
CREATE INDEX "documents_tenantId_idx" ON "documents"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_storageKey_key" ON "documents"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "document_pages_documentId_pageNumber_key" ON "document_pages"("documentId", "pageNumber");

-- CreateIndex
CREATE INDEX "extraction_runs_projectId_createdAt_idx" ON "extraction_runs"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "section_extractions_projectId_sectionKey_idx" ON "section_extractions"("projectId", "sectionKey");

-- CreateIndex
CREATE INDEX "section_extractions_extractionRunId_idx" ON "section_extractions"("extractionRunId");

-- CreateIndex
CREATE INDEX "evidence_items_projectId_sectionKey_fieldPath_idx" ON "evidence_items"("projectId", "sectionKey", "fieldPath");

-- CreateIndex
CREATE INDEX "field_overrides_projectId_sectionKey_idx" ON "field_overrides"("projectId", "sectionKey");

-- CreateIndex
CREATE UNIQUE INDEX "section_confirmations_projectId_sectionKey_key" ON "section_confirmations"("projectId", "sectionKey");

-- CreateIndex
CREATE INDEX "project_contracts_projectId_idx" ON "project_contracts"("projectId");

-- CreateIndex
CREATE INDEX "contract_parties_contractId_idx" ON "contract_parties"("contractId");

-- CreateIndex
CREATE INDEX "contract_clauses_contractId_clauseId_idx" ON "contract_clauses"("contractId", "clauseId");

-- CreateIndex
CREATE INDEX "genotypes_projectId_lifecycle_idx" ON "genotypes"("projectId", "lifecycle");

-- CreateIndex
CREATE INDEX "phases_projectId_sortOrder_idx" ON "phases"("projectId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "phase_genotypes_phaseId_genotypeId_key" ON "phase_genotypes"("phaseId", "genotypeId");

-- CreateIndex
CREATE INDEX "protocols_projectId_idx" ON "protocols"("projectId");

-- CreateIndex
CREATE INDEX "protocols_phaseId_idx" ON "protocols"("phaseId");

-- CreateIndex
CREATE INDEX "protocol_parameters_protocolId_family_idx" ON "protocol_parameters"("protocolId", "family");

-- CreateIndex
CREATE INDEX "chronology_events_projectId_date_idx" ON "chronology_events"("projectId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "species_botanicalName_key" ON "species"("botanicalName");

-- CreateIndex
CREATE INDEX "parameter_definitions_speciesId_family_idx" ON "parameter_definitions"("speciesId", "family");

-- CreateIndex
CREATE INDEX "parameter_definitions_level_family_idx" ON "parameter_definitions"("level", "family");

-- CreateIndex
CREATE INDEX "field_observer_assignments_projectId_userId_idx" ON "field_observer_assignments"("projectId", "userId");

-- CreateIndex
CREATE INDEX "field_observer_assignments_genotypeId_farmId_idx" ON "field_observer_assignments"("genotypeId", "farmId");

-- CreateIndex
CREATE UNIQUE INDEX "project_overviews_projectId_key" ON "project_overviews"("projectId");

-- CreateIndex
CREATE INDEX "supply_chain_actors_projectId_idx" ON "supply_chain_actors"("projectId");

-- CreateIndex
CREATE INDEX "supply_chain_edges_projectId_idx" ON "supply_chain_edges"("projectId");

-- CreateIndex
CREATE INDEX "ip_rights_projectId_type_idx" ON "ip_rights"("projectId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ip_pbrs_ipRightId_key" ON "ip_pbrs"("ipRightId");

-- CreateIndex
CREATE UNIQUE INDEX "ip_patents_ipRightId_key" ON "ip_patents"("ipRightId");

-- CreateIndex
CREATE UNIQUE INDEX "ip_trademarks_ipRightId_key" ON "ip_trademarks"("ipRightId");

-- CreateIndex
CREATE INDEX "todo_tasks_projectId_category_idx" ON "todo_tasks"("projectId", "category");

-- CreateIndex
CREATE INDEX "todo_tasks_assignedToId_idx" ON "todo_tasks"("assignedToId");

-- CreateIndex
CREATE INDEX "quarantines_projectId_status_idx" ON "quarantines"("projectId", "status");

-- CreateIndex
CREATE INDEX "jobs_status_availableAt_idx" ON "jobs"("status", "availableAt");

-- CreateIndex
CREATE INDEX "jobs_projectId_idx" ON "jobs"("projectId");

-- CreateIndex
CREATE INDEX "jobs_tenantId_idx" ON "jobs"("tenantId");

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "species"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farms" ADD CONSTRAINT "farms_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plots" ADD CONSTRAINT "plots_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_extractions" ADD CONSTRAINT "section_extractions_extractionRunId_fkey" FOREIGN KEY ("extractionRunId") REFERENCES "extraction_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_extractions" ADD CONSTRAINT "section_extractions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_sectionExtractionId_fkey" FOREIGN KEY ("sectionExtractionId") REFERENCES "section_extractions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_overrides" ADD CONSTRAINT "field_overrides_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_overrides" ADD CONSTRAINT "field_overrides_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_confirmations" ADD CONSTRAINT "section_confirmations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_confirmations" ADD CONSTRAINT "section_confirmations_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_contracts" ADD CONSTRAINT "project_contracts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_contracts" ADD CONSTRAINT "project_contracts_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_parties" ADD CONSTRAINT "contract_parties_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "project_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_clauses" ADD CONSTRAINT "contract_clauses_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "project_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "genotypes" ADD CONSTRAINT "genotypes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phases" ADD CONSTRAINT "phases_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phase_genotypes" ADD CONSTRAINT "phase_genotypes_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phase_genotypes" ADD CONSTRAINT "phase_genotypes_genotypeId_fkey" FOREIGN KEY ("genotypeId") REFERENCES "genotypes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocols" ADD CONSTRAINT "protocols_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocols" ADD CONSTRAINT "protocols_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocols" ADD CONSTRAINT "protocols_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "species"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocol_parameters" ADD CONSTRAINT "protocol_parameters_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "protocols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chronology_events" ADD CONSTRAINT "chronology_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parameter_definitions" ADD CONSTRAINT "parameter_definitions_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_observer_assignments" ADD CONSTRAINT "field_observer_assignments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_observer_assignments" ADD CONSTRAINT "field_observer_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_observer_assignments" ADD CONSTRAINT "field_observer_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_observer_assignments" ADD CONSTRAINT "field_observer_assignments_genotypeId_fkey" FOREIGN KEY ("genotypeId") REFERENCES "genotypes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_observer_assignments" ADD CONSTRAINT "field_observer_assignments_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_observer_assignments" ADD CONSTRAINT "field_observer_assignments_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "plots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_observer_assignments" ADD CONSTRAINT "field_observer_assignments_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "protocols"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_overviews" ADD CONSTRAINT "project_overviews_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_chain_actors" ADD CONSTRAINT "supply_chain_actors_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_chain_edges" ADD CONSTRAINT "supply_chain_edges_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_chain_edges" ADD CONSTRAINT "supply_chain_edges_fromActorId_fkey" FOREIGN KEY ("fromActorId") REFERENCES "supply_chain_actors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_chain_edges" ADD CONSTRAINT "supply_chain_edges_toActorId_fkey" FOREIGN KEY ("toActorId") REFERENCES "supply_chain_actors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_chain_edges" ADD CONSTRAINT "supply_chain_edges_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "project_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ip_rights" ADD CONSTRAINT "ip_rights_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ip_rights" ADD CONSTRAINT "ip_rights_genotypeId_fkey" FOREIGN KEY ("genotypeId") REFERENCES "genotypes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ip_pbrs" ADD CONSTRAINT "ip_pbrs_ipRightId_fkey" FOREIGN KEY ("ipRightId") REFERENCES "ip_rights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ip_patents" ADD CONSTRAINT "ip_patents_ipRightId_fkey" FOREIGN KEY ("ipRightId") REFERENCES "ip_rights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ip_trademarks" ADD CONSTRAINT "ip_trademarks_ipRightId_fkey" FOREIGN KEY ("ipRightId") REFERENCES "ip_rights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_tasks" ADD CONSTRAINT "todo_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todo_tasks" ADD CONSTRAINT "todo_tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarantines" ADD CONSTRAINT "quarantines_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarantines" ADD CONSTRAINT "quarantines_genotypeId_fkey" FOREIGN KEY ("genotypeId") REFERENCES "genotypes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
