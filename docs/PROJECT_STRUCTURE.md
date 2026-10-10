# Project Modules — Structure Reference

This document explains the role of every folder and file inside `src/modules/project/` and `docs/extraction-guides/`. Keep it updated when adding new sections or infrastructure.

---

## Top-level layout

```
src/modules/project/
├── sections/           The five current project sections
├── framework/          Static knowledge layers shared across all sections
├── prompt/             Prompt file loader and composition utilities
├── llm/                LLM provider abstraction + implementations
├── storage/            Object storage abstraction (MinIO / Hetzner OS / S3)
├── ingestion/          Text extraction from uploaded documents
├── extraction/         Start run, corpus, evidence persist, chronology deriver
├── review/             VM draft edits, review-state, confirm + domain promote
├── chat/               Section review chatbot (usual, source, conflict, missing, apply)
└── jobs/               Postgres job queue (enqueue + SKIP LOCKED worker)

docs/
├── extraction-guides/  Human-readable spec for each section (per-field tables)
├── PROJECT_STRUCTURE.md  ← this file
functional_req_docs/    Client-provided source documents (never edit)
```

---

## `src/modules/project/sections/`

The registry and the five current section definitions.

### `sections/registry.js`

The single source of truth. Imports all section definitions and exposes:

| Export | What it returns |
|--------|-----------------|
| `getSection(key)` | One section by key — throws if not found |
| `getEnabledSections()` | Enabled sections sorted by default order |
| `getAllSections()` | All registered sections, sorted by order |
| `getExtractorSections()` | Enabled sections whose kind is `'extractor'` |
| `getDeriverSections()` | Enabled sections whose kind is `'deriver'` |
| `isSectionKey(key)` | Boolean check — does not throw |

**To add a new section:** create the folder, write the files, import in registry.js, call `register()`. Nothing else changes.

### `sections/_shared/evidence.schema.js`

The `evidenceItemSchema` and `evidenceArraySchema` Zod schemas used by every section's extraction output. Contains the full field descriptions for the Why Button (document, page, quote, framework element). Imported by every `*.schema.js` file.

### Section folder structure (`sections/<key>/`)

Each section has the same layout:

| File | Role |
|------|------|
| `index.js` | Section definition object: key, label, order, kind, enabled, schema, rules, promptDir, relevantDocTypes |
| `<key>.schema.js` | Zod schema for the section's extraction output. Field `.describe()` strings are the extraction instructions — they appear in the JSON Schema sent to the LLM |
| `<key>.rules.js` | Confirmation blocking rules and warnings. Evaluated server-side in the review API (Step 7). Never enforced only in the frontend |
| `prompts/` | Numbered Markdown fragments assembled by `prompt/compose.js` |
| `prompts/00-role.md` | AI role instruction and core extraction principles for this section |
| `prompts/20-classification.md` | Contract: classification methodology. Other sections: domain-specific classification logic if needed |
| `prompts/30-obligation-maps.md` | Contract: per-contract-type obligation maps. Other sections: not present |
| `prompts/40-flags-and-gaps.md` | Contract: ABSENCE/ANOMALY/IMBALANCE methodology. Other sections: not present |
| `prompts/90-output-rules.md` | Output format rules: null handling, date format, array rules, what not to do |
| `fixtures/golden/` | Contract only: redacted contract text + expected extraction output for eval harness (Step 5) |

**Numbered prefix rule:** Files are loaded in alphabetical sort order. Use two-digit prefixes to control assembly order: `00-` → `20-` → `30-` → `40-` → `90-`. Gap the numbers so new fragments can be inserted without renaming.

### Section kinds

| Kind | Description | Prompt used for |
|------|-------------|----------------|
| `extractor` | Runs an LLM extraction pass over uploaded documents | Full extraction + section AI chat |
| `deriver` | Aggregates structured output from other sections (no direct doc read) | Section AI chat only |

Currently: Contract, Genotype, Phase, Protocol are extractors. Chronology is a deriver.

### Current sections

| Section | Key | Kind | Notes |
|---------|-----|------|-------|
| Contracts | `contract` | extractor | Full implementation, extraction guide complete |
| Genotype | `genotype` | extractor | Schema + prompts complete; extraction guide draft |
| Phases | `phase` | extractor | Schema + prompts complete; extraction guide draft |
| Protocols | `protocol` | extractor | Schema + prompts complete; extraction guide draft |
| Chronology | `chronology` | deriver | Derives from the other four sections |

---

## `src/modules/project/framework/`

### `framework/prompts/`

Three Markdown files that are prepended to **every** section prompt, in alphabetical sort order:

| File | Contents | Source |
|------|----------|--------|
| `glossary.md` | Complete NuBred Domain Glossary — 9 sections, 60+ terms | Doc E (Glossary v1) |
| `phase-framework.md` | 4 standard phases, gate logic, parameter families F1–F7, eliminatory levels | Doc F + Glossary Section 6 |
| `clause-library.md` | 45 AgreeLyze standard clause categories (C-01 to C-45), severity guidelines | ContractExtractionGuide + inference |

**Why static files, not database rows?** Prompts that live in the database can silently drift out of sync with the Zod schemas they inform. Prompts are code — they belong in git with full diff history. If the client later needs non-developer prompt editing, add a DB override layer on top.

**Caching:** These files are the static prefix of every prompt. Both Gemini context caching and Anthropic prompt caching key on a stable prefix — framework layers must always come first in the composed prompt for caching to work.

> Note: `phase-framework.md` now covers 8 parameter families (F1–F8), Observational vs Commercial protocol types, and Capitolato as a hard Pilot→Launch gate (Doc B / Doc C V4).

---

## `src/modules/project/prompt/`

### `prompt/loader.js`

Loads Markdown prompt files from disk with mtime-based cache. Two exports:

| Export | What it does |
|--------|-------------|
| `loadPromptFile(path)` | Load one `.md` file. Returns `{ content, hash }`. Cached by path + mtime. |
| `loadPromptDir(dirPath)` | Load all `.md` files in a directory sorted alphabetically. Returns combined `{ content, hash, files }`. |
| `clearPromptCache()` | Invalidate cache — for tests. |

The `hash` is SHA-256 of the file content. Used for prompt version tracking on analysis run records.

### `prompt/compose.js`

Assembles the full system prompt for a section extraction run.

| Export | What it does |
|--------|-------------|
| `composeSystemPrompt(sectionPromptDir)` | Framework layers + section fragments → `{ content, hash }`. Hash stored on every run record. |
| `composeChatSystemPrompt(roleMdPath)` | Lighter version for section AI chat — framework + role only. |
| `invalidateFrameworkCache()` | Force-reload framework layer — for tests. |

**Layer order:** Framework (glossary → phase-framework → clause-library) then section-specific fragments. Framework is always the stable prefix for provider-side caching.

---

## `src/modules/project/llm/`

### `llm/provider.js`

The `LLMProvider` base class and singleton resolution. All AI calls in this codebase MUST go through `getProvider()` or `initProvider()` — never call the Gemini or Anthropic SDK directly outside this module.

| Export | What it does |
|--------|-------------|
| `LLMProvider` | Abstract base class with `extract()` and `chat()` methods |
| `getProvider()` | Returns the active singleton (synchronous after init) |
| `ensureProvider()` | Async; initialises on first use if startup init failed |
| `setProvider(p)` | Override active provider — for tests |
| `initProvider()` | Async initialisation at app startup |

Active provider is controlled by `NUBRED_LLM_PROVIDER` env var: `'gemini'` (default) or `'mock'`.

### `llm/gemini.provider.js`

Google Generative AI implementation. Requires `GEMINI_API_KEY` env var.

- Uses Gemini's `responseSchema` structured output config with JSON Schema derived from the Zod schema.
- Temperature: 0.1 for extraction (deterministic), 0.3 for chat.
- Rate-limit token bucket — default **12 RPM** (`gemini-3.5-flash-lite` free tier is 15 RPM / 500 RPD). Google 429 → job retry with `retryAfterMs`. Switch to `gemini-3.6-flash` and raise `GEMINI_RPM_LIMIT` on a paid key.
- Extraction is **contract-first**: only the contract job is queued at start. After it finishes, genotype / phase / protocol are queued together and may run in parallel (`NUBRED_JOB_CONCURRENCY`, default 3).
- Lazy SDK import so the Google AI package is only loaded when needed.

**⚠️ Free tier note:** Free-tier content may be used by Google to improve their models. Do not send real client contracts through the free tier. Use the `MockProvider` during development and redacted fixtures for testing. Switch to a paid key before production.

### `llm/mock.provider.js`

Development and test implementation. No API key required.

- Set `NUBRED_LLM_PROVIDER=mock` in `.env` for development without a key.
- Tracks all calls in `mock.calls[]` for test assertions.
- `mock.setFixture(data)` — return a specific object on the next `extract()` call.
- `mock.reset()` — clear calls and fixture between test cases.
- When no fixture is set, returns a minimal null-filled object from the schema shape.

---

## `src/modules/project/storage/`

Object storage for confidential project documents. Callers never talk to MinIO/Hetzner/S3 directly — they use `getStorage()` after `initStorage()` at startup.

| File | Role |
|------|------|
| `provider.js` | `StorageProvider` interface + `initStorage()` / `getStorage()` |
| `s3.provider.js` | S3-compatible implementation (MinIO, Hetzner Object Storage, AWS S3, R2) |
| `keys.js` | Object key layout: `tenants/{tenantId}/projects/{projectId}/documents/{documentId}/{filename}` |
| `allowed.js` | MIME allow-list, max size, `documentType` enum |

**Switching from MinIO to Hetzner OS:** change `AWS_S3_ENDPOINT`, region, bucket, and credentials in `.env`. No code change. Leave `NUBRED_STORAGE_PROVIDER=s3`.

**Local MinIO:** `npm run minio:up` then copy storage vars from `.env.sample`. Console: http://localhost:9001 (minioadmin / minioadmin).

### Upload API (Step 2)

Mounted at `/api/projects`. Send Clerk `Authorization` and `X-Tenant-Slug` (defaults to `dev` on localhost).

| Method | Path | Who |
|--------|------|-----|
| POST | `/api/projects` | Authenticated user (bootstraps tenant if empty) |
| GET | `/api/projects` | Tenant member |
| GET | `/api/projects/:projectId` | Project member / creator |
| POST | `/api/projects/:projectId/documents/init-upload` | Variety Manager |
| POST | `/api/projects/:projectId/documents/:documentId/complete` | Variety Manager |
| GET | `/api/projects/:projectId/documents` | Project member |
| GET | `/api/projects/:projectId/documents/:documentId` | Project member (`?includeText=true` after READY) |
| GET | `/api/projects/:projectId/documents/:documentId/download` | Project member (presigned GET) |
| DELETE | `/api/projects/:projectId/documents/:documentId` | Variety Manager |

| POST | `/api/projects/:projectId/extractions` | Variety Manager — start AI analysis |
| GET | `/api/projects/:projectId/extractions` | Project member |
| GET | `/api/projects/:projectId/extractions/latest` | Project member (`?includePayload=true`) |
| GET | `/api/projects/:projectId/extractions/:extractionRunId` | Project member |

Frontend flow: `init-upload` → `PUT` file to `upload.url` with `upload.headers` → `complete` → poll GET until `status` is `READY` or `FAILED` → `POST .../extractions` → poll `GET .../extractions/latest`.

`complete` verifies the object, marks the document `PROCESSING`, and enqueues an `EXTRACT_TEXT` job. The job worker downloads the blob and writes `DocumentPage` rows.

`POST .../extractions` creates an `ExtractionRun` and queues **only the contract** `EXTRACT_SECTION` job. When that job finishes, `fanout.js` queues genotype, phase, and protocol (they may run in parallel). `DERIVE_CHRONOLOGY` runs when all extractors are terminal.

## `src/modules/project/extraction/`

| File | Role |
|------|------|
| `start.js` | Create run + section rows; enqueue **lead** extractor (contract) only |
| `fanout.js` | After contract finishes, enqueue remaining EXTRACT_SECTION jobs |
| `corpus.js` | Assemble READY `DocumentPage` text for the LLM |
| `evidence.js` | Write `EvidenceItem` rows + `fieldMeta` confidence map |
| `finalize.js` | Token totals, enqueue chronology, roll up run status |
| `derive-chronology.js` | Deterministic timeline from other section payloads (no LLM) |

## `src/modules/project/review/`

VM review of extraction drafts. Chatbot writes reuse `patch-field.js` with source `CHATBOT`.

| File | Role |
|------|------|
| `path.js` | Parse / get / set `parties[0].name` style paths; reject `evidence*` |
| `evaluate-rules.js` | Run a section's `*.rules.js` blocking + warning descriptors |
| `patch-field.js` | PATCH one field, Zod-validate, write `FieldOverride` (`VM_MANUAL`) |
| `review-state.js` | Merge `{ gapsTabViewed }` onto `SectionExtraction.reviewState` |
| `get-section.js` | Assemble GET payload: draft + rules + confirmation + overrides |
| `confirm.js` | Block on rules, upsert `SectionConfirmation`, call promote |
| `promote.js` | Copy confirmed payload into Contract / Genotype / Phase / Protocol / Chronology tables |
| `enums.js` | Prisma enum allow-lists used during promote |
| `load.js` | Latest section row helpers + serializers |

HTTP: `src/controllers/review.controller.js` via `src/routes/project.routes.js`.
Frontend contract: `docs/api/review.md`.

## `src/modules/project/chat/`

Section review chatbot. Writes go through `patchSectionField` with `FieldOverrideSource.CHATBOT`.
Chatbot uploads are `Document.origin = CHATBOT` and are excluded from full-section extraction.

| File | Role |
|------|------|
| `intents.js` | Intent names, inference, value coerce |
| `schema.js` | Zod schema for structured Gemini turns |
| `context.js` | Draft + corpus + evidence for the active section |
| `apply.js` | Apply field writes + evidence append |
| `run.js` | Dispatch usual / source / resolve_conflict / fill_missing / apply_change |

HTTP: `POST /api/projects/:projectId/sections/:sectionKey/chat`
Frontend contract: `docs/api/chat.md`.

## `src/modules/project/jobs/`

Postgres-backed queue. HTTP handlers only insert rows; a single worker process claims and runs them.

| File | Role |
|------|------|
| `types.js` | Job type constants (`EXTRACT_TEXT`, `EXTRACT_SECTION`, `DERIVE_CHRONOLOGY`) |
| `enqueue.js` | `enqueueJob()` — insert `PENDING` row (accepts a Prisma `tx`) |
| `worker.js` | Claim via `FOR UPDATE SKIP LOCKED`, retries, stuck-lock reclaim |
| `handlers/extract-text.js` | Blob → pages → `READY` |
| `handlers/extract-section.js` | LLM structured extraction for one section |
| `handlers/derive-chronology.js` | Timeline from extractor payloads |
| `handlers/registry.js` | type → handler map |

**Why Postgres, not Redis/Bull:** the `Job` table already exists, Neon is already the system of record, and `SKIP LOCKED` is safe under PM2 cluster mode. API workers all enqueue; only `NODE_APP_INSTANCE=0` (or `npm run dev`) runs `startJobWorker()`.

**Claim SQL:** `UPDATE … WHERE id = (SELECT id FROM jobs WHERE status = PENDING AND availableAt <= now() ORDER BY availableAt LIMIT 1 FOR UPDATE SKIP LOCKED)`. Concurrent workers skip locked rows instead of blocking.

**Retries:** 3 attempts, exponential backoff (2s → 60s cap). Exhausted jobs become `DEAD` and `EXTRACT_TEXT` marks the document `FAILED`. Running jobs whose `lockedAt` is older than `NUBRED_JOB_LOCK_TIMEOUT_SECONDS` (default 600) are reclaimed as `PENDING`.

**Adding a handler:** implement `handlers/<type>.js`, register it in `handlers/registry.js`, enqueue with `enqueueJob({ type, payload })`. No change to the worker loop.

## `src/modules/project/ingestion/`

| File | Role |
|------|------|
| `extract-text.js` | Dispatches by MIME type |
| `extractors/pdf.js` | Per-page text via `unpdf` |
| `extractors/docx.js` | Single page via `mammoth` |
| `extractors/spreadsheet.js` | One page per sheet via `exceljs` |
| `extractors/plaintext.js` | UTF-8 |

---

## `docs/extraction-guides/`

Human-readable specifications for each section, derived from the client source documents. These are the source of truth for **what** the AI should extract. The Zod schemas are the source of truth for **how** the output is structured.

| File | Status | Source |
|------|--------|--------|
| `contract.md` | ✅ Complete | ContractExtractionGuide V1 (46 real contracts) |
| `genotype.md` | 📝 Draft | Doc F V2 Section 2 |
| `phase.md` | 📝 Draft | Doc F V2 Section 4 |
| `protocol.md` | 📝 Draft | Doc F V2 Protocols section |
| `chronology.md` | 📝 Draft | Doc F V2 Chronology section |

When a section guide reaches "Complete" status, it means:
1. All fields in the schema have a corresponding row in the guide's field table.
2. Every field has a documented source, format, and example.
3. The guide has been reviewed against a real contract.

## `docs/api/`

Frontend integration contracts. Copy these into the frontend repo.

| File | Use for |
|------|---------|
| `_conventions.md` | Base URL, auth, upload sequence |
| `projects.md` | Create / get project |
| `documents.md` | Upload until `READY` |
| `extractions.md` | Start analysis + poll drafts |
| `frontend-extraction-ui.md` | snake_case field binding |
| `review.md` | GET section, PATCH fields, Gaps tab, POST confirm |
| `chat.md` | Nubred AI chatbot on the review screen |

---

## `functional_req_docs/`

Client-provided source documents. Never edit these files. Use them only as read-only references. All knowledge from these documents has been incorporated into the extraction guides and framework prompts.

| File | What it contains |
|------|-----------------|
| `NuBred_DocA_MultiActorPortal_Roles_V3_130526.pdf` | Four actor roles, visibility matrix, Active/Pending states |
| `NuBred_DocB_ProjectStructure_PhaseGates_v1_160426.pdf` | Standard phases, gate logic, Capitolato, Promote/Repeat/Discard |
| `NuBred_DocC_Protocol_ParameterSchema_V4_130526.pdf` | 8 parameter families, input types, protocol types, kiwi registry |
| `NuBred_DocK_Protocols_Observations_V3_130526.pdf` | Observation module, backend entities, UI-frozen vs backend-active |
| `NuBred_DocE_Glossary_v1_220426.pdf` | Standard terminology for all NuBred documents, DB schema, UI copy, and AI prompts |
| `NuBred_DocF_ProjectCreationFlow_V2_130526.pdf` | Complete project creation flow — input channels, confidence levels, per-section AI extraction specs |
| `NuBred_AI_ContractExtractionGuide_V1.pdf` | Detailed contract extraction schema built from 46 real contracts — primary source for the Contract section |

---

## Prisma data model (`prisma/schema.prisma`)

Step 1 of Project Creation. Enums match the Zod constants in `src/modules/project/sections/**`. Hyphenated codes (e.g. `MF-1`) are stored as `String`.

| Group | Models |
|-------|--------|
| Tenant isolation | `Tenant`, `TenantMember` — subdomain `companyone.nubred.com` maps to `Tenant.slug` |
| Project & actors | `Project`, `ProjectMember` (project-scoped role + Active/Pending), `Farm`, `Plot` |
| Documents | `Document` (S3 `storageKey`, never a public URL), `DocumentPage` (text + page number for Why Button offsets) |
| Provenance | `ExtractionRun`, `SectionExtraction`, `EvidenceItem`, `FieldOverride`, `SectionConfirmation` |
| Confirmed domain | `ProjectContract` + parties/clauses, `Genotype`, `Phase`, `PhaseGenotype`, `Protocol`, `ProtocolParameter`, `ChronologyEvent` |
| Registry | `Species`, `ParameterDefinition` (Level 1/2; Level 3 is `ProtocolParameter.isCustom`) |
| Activation | `FieldObserverAssignment` (VM assigns observers at activation — multi-farm) |
| Frozen UI, tables live | `ProjectOverview`, `SupplyChainActor`/`Edge`, `IpRight` + PBR/Patent/Trademark children, `TodoTask`, `Quarantine` |
| Queue | `Job` — `EXTRACT_TEXT`, `EXTRACT_SECTION`, `DERIVE_CHRONOLOGY` |

**Deferred (runtime observation, not extracted from documents):** `ObservationSession`, `ObservationValue`, `GenotypePerformance`, `AgronomicOperation`.

**S3 key layout (one bucket per environment, prefix per tenant):**
`tenants/{tenantId}/projects/{projectId}/documents/{documentId}/{filename}`

Uploads use presigned PUT: `init-upload` creates a `Document` in `PENDING_UPLOAD`, frontend PUTs to S3, `complete-upload` verifies the object and queues text extraction. Cloudinary stays for blog images only.

## Environment variables (new for this module)

Add these to `.env` and `.env.sample`:

| Variable | Default | Description |
|----------|---------|-------------|
| `NUBRED_LLM_PROVIDER` | `gemini` | Active LLM provider: `gemini` or `mock` |
| `GEMINI_API_KEY` | — | Google AI Studio API key (required for gemini provider) |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Model to use. Free-tier default; paid quality is `gemini-3.6-flash` (`gemini-2.0-flash` is retired) |
| `GEMINI_RPM_LIMIT` | `12` | Requests per minute cap (free Lite = 15 RPM; stay under) |
| `AWS_REGION` | — | S3 region (e.g. `eu-central-1`) |
| `AWS_S3_BUCKET` | — | Private documents bucket |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | — | IAM credentials for the backend |
| `AWS_S3_ENDPOINT` | empty for AWS S3 | MinIO: `http://localhost:9000`. Hetzner: your cluster host |
| `AWS_S3_PUBLIC_ENDPOINT` | same as endpoint | Browser-facing host if it differs from `AWS_S3_ENDPOINT` |
| `AWS_S3_FORCE_PATH_STYLE` | true when endpoint set | `false` for native AWS S3 |
| `NUBRED_STORAGE_PROVIDER` | `s3` | Currently only `s3` (S3-compatible) |
| `NUBRED_DEFAULT_TENANT_SLUG` | `dev` | Used when Host has no tenant subdomain |
| `NUBRED_MAX_UPLOAD_BYTES` | `52428800` | 50 MB default |
| `NUBRED_JOB_POLL_MS` | `1000` | Worker poll interval |
| `NUBRED_JOB_CONCURRENCY` | `3` | Jobs in parallel after contract finishes. Set `1` if large contracts hit the 250K TPM cap |
| `NUBRED_JOB_LOCK_TIMEOUT_SECONDS` | `600` | Reclaim RUNNING jobs after a dead worker |
| `NUBRED_EXTRACTION_MAX_CHARS` | `350000` | Max document text sent to the LLM per section |
