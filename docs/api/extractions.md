POST /api/projects/:projectId/extractions
-------------------------------
Request:
  Auth: required
  Headers:
    X-Tenant-Slug: string
  Params:
    projectId: string
  Body: none (empty JSON object is fine)

Response 202:
  {
    "success": true,
    "message": "Extraction queued. Poll GET /api/projects/:projectId/extractions/latest?includePayload=true — render each section as its status becomes SUCCEEDED; do not wait for the whole run.",
    "extraction": {
      "id": string,
      "projectId": string,
      "status": "QUEUED",
      "promptHash": null,
      "modelId": null,
      "provider": "gemini" | "mock",
      "inputTokens": 0,
      "outputTokens": 0,
      "startedAt": null,
      "completedAt": null,
      "error": null,
      "createdAt": string,
      "updatedAt": string,
      "sections": [
        {
          "id": string,
          "sectionKey": "contract" | "genotype" | "phase" | "protocol" | "chronology",
          "status": "QUEUED",
          "promptHash": null,
          "modelId": null,
          "error": null,
          "createdAt": string,
          "updatedAt": string,
          "evidenceCount": 0
        }
      ]
    }
  }

Errors:
  400 { "success": false, "message": "At least one READY document is required before starting AI extraction." }
  401 unauthorized
  403 editor-only (creator or ACTIVE VARIETY_MANAGER)
  404 { "success": false, "message": "Project not found." }
  409 {
        "success": false,
        "message": "An extraction run is already in progress for this project.",
        "extraction": { "id": string, "status": "QUEUED" | "RUNNING", ... }
      }

Notes:
  - Call this AFTER documents are READY (upload complete + text extraction finished).
  - Uses ALL READY documents on the project. Upload more files, wait until READY, then start analysis (or start again after the previous run finishes).
  - Contract-first: only the contract EXTRACT_SECTION job is queued at start. When it finishes (SUCCEEDED or FAILED), genotype, phase, and protocol jobs are queued and may run in parallel (`NUBRED_JOB_CONCURRENCY`, default 3).
  - Chronology is NOT an LLM call. It is derived after all extractors are terminal.
  - 202 means queued, not finished. Poll `latest?includePayload=true` immediately — contract payload is available as soon as that section succeeds, while the run is still RUNNING.
  - 409 if a run is still QUEUED or RUNNING. Wait for it to finish (or poll that run) before starting another.
  - Re-running after SUCCEEDED/PARTIAL/FAILED creates a new ExtractionRun. Previous runs stay in history. Confirmed domain tables are NOT written in this step — this is still a draft for VM review.
  - After a section is SUCCEEDED, use the review APIs in docs/api/review.md (GET/PATCH/confirm). Do not start a new extraction while the VM is reviewing the current run.
  - Local without Gemini: set NUBRED_LLM_PROVIDER=mock. Mock returns empty/null-filled section objects so the pipeline can be tested end-to-end.


GET /api/projects/:projectId/extractions
-------------------------------
Request:
  Auth: required
  Headers:
    X-Tenant-Slug: string
  Params:
    projectId: string

Response 200:
  {
    "success": true,
    "count": number,
    "extractions": [ /* same extraction object as POST, newest first; payloads omitted */ ]
  }

Errors:
  401 unauthorized
  403 viewer-only
  404 project not found

Notes:
  - Payloads are omitted here (list view). Use GET by id or latest?includePayload=true for drafts.


GET /api/projects/:projectId/extractions/latest
-------------------------------
Request:
  Auth: required
  Headers:
    X-Tenant-Slug: string
  Params:
    projectId: string
  Query:
    includePayload: "true" | omitted     // default false

Response 200 (includePayload omitted):
  {
    "success": true,
    "extraction": {
      "id": string,
      "status": "QUEUED" | "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED",
      "provider": string | null,
      "modelId": string | null,
      "inputTokens": number | null,
      "outputTokens": number | null,
      "startedAt": string | null,
      "completedAt": string | null,
      "sections": [
        {
          "id": string,
          "sectionKey": string,
          "status": "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED",
          "error": string | null,
          "evidenceCount": number
        }
      ]
    }
  }

Response 200 (includePayload=true):
  Same as above, plus each section includes:
    payload: object | null     // Zod-validated draft (null if FAILED)
    fieldMeta: object | null   // { [fieldPath]: { confidence, sources } }
    evidence: [                // Why-button citations
      {
        "id": string,
        "fieldPath": string,
        "documentName": string,
        "page": number | null,
        "charOffset": number | null,
        "quote": string,
        "frameworkElement": string | null,
        "documentId": string | null
      }
    ]
  Top-level "sections" repeats the detailed section list for convenience.

Errors:
  404 { "success": false, "message": "No extraction run found for this project." }

Notes:
  - Poll every 2–3 seconds with `includePayload=true` while the run is QUEUED or RUNNING.
  - Render a section as soon as `sections[i].status === "SUCCEEDED"` — do not wait for `extraction.status` to become terminal. Contract is first; typical time-to-first-draft is one LLM call (~60–90s on Gemini).
  - Keep polling until `extraction.status` is SUCCEEDED, PARTIAL, or FAILED so remaining sections fill in.
  - PARTIAL = at least one section succeeded and at least one failed. Still show successful section drafts.
  - Section statuses complete at different times (contract SUCCEEDED while protocol is still RUNNING).
  - chronology stays QUEUED until all extractors are terminal, then RUNNING → SUCCEEDED.
  - confidence on fieldMeta: CONFIRMED (has evidence), PROVISIONAL (value but no citation), MISSING (null), CONFLICTING (two sources disagree). After a VM PATCH, origin is VM_MANUAL and confidence is PROVISIONAL or MISSING — see docs/api/review.md.


GET /api/projects/:projectId/extractions/:extractionRunId
-------------------------------
Request:
  Auth: required
  Headers:
    X-Tenant-Slug: string
  Params:
    projectId: string
    extractionRunId: string
  Query:
    includePayload: "true" | "false"     // default true on this route

Response 200:
  Same shape as GET latest with includePayload=true (unless includePayload=false).

Errors:
  404 { "success": false, "message": "Extraction run not found." }

Notes:
  - Default includes payloads so the review UI can load a specific run from history.


Frontend flow (progressive review)
----------------------------------
  1. Wait until GET documents shows status READY for the files you need.
  2. POST /api/projects/:projectId/extractions  → save extraction.id
     Do not block on this request for results (202 = queued).
  3. Poll GET /api/projects/:projectId/extractions/latest?includePayload=true
     every 2–3 seconds. Client timeout per poll: ~15s. Overall wait: several minutes is OK.
  4. Drive the UI from `sections[]`, not only `extraction.status`:
       - QUEUED / RUNNING → spinner for that section
       - SUCCEEDED → render that section's payload + fieldMeta + evidence (Why?)
       - FAILED → show section.error
     Open the Contract review view as soon as contract is SUCCEEDED. Other sections
     keep extracting in the background.
  5. Stop polling when extraction.status is SUCCEEDED | PARTIAL | FAILED.
  6. Review / edit / confirm: docs/api/review.md
     Chatbot: docs/api/chat.md.

  Full field-binding guide (copy into the frontend repo):
    docs/api/frontend-extraction-ui.md
  Identity / Parties / Penalties bind to contract.payload (snake_case), not to
  AgreeLyze clause titles (C-01–C-45).

  Suggested UI: one progress row per sectionKey (contract, genotype, phase, protocol, chronology).
  Suggested client timeout: do not abort the whole analysis after 30–60s — only abort a single poll request and retry.


ExtractionRun status
--------------------
  QUEUED     jobs inserted, worker has not started
  RUNNING    at least one section job started
  SUCCEEDED  every section SUCCEEDED
  PARTIAL    mix of SUCCEEDED and FAILED
  FAILED     every section FAILED (or extractors all failed so chronology was skipped)
