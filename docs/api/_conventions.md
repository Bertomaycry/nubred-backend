Project Creation APIs — Frontend conventions
=============================================

Base URL:
  Local:  http://localhost:8080
  Mount:  /api/projects

All project and document routes below are relative to that mount.
Example: POST /api/projects  →  http://localhost:8080/api/projects


Shared request headers (every call except the MinIO PUT)
--------------------------------------------------------
  Authorization: Bearer <Clerk session JWT>     // required
  Content-Type: application/json                // required for POST bodies
  X-Tenant-Slug: <tenant slug>                  // strongly recommended

Notes:
  - Auth is Clerk. Send the same Bearer token used on existing /api/auth and /api/profile routes.
  - X-Tenant-Slug identifies the organisation. On localhost, if omitted, the backend defaults to "dev" and will create that tenant on first use.
  - Production: always send X-Tenant-Slug (or use a tenant subdomain). Do not rely on the default.
  - CORS allows Authorization and X-Tenant-Slug. Frontend origin must be one of:
      http://localhost:5173
      https://preview.nubred.com
      https://governance.nubred.com
      https://node.nubred.com
  - JSON body limit is 50 KB. File bytes never go through this API.


Error envelope (all project/document routes)
--------------------------------------------
  {
    "success": false,
    "message": string
  }

  Some responses also include "document" when a document-state conflict occurs.

  Clerk unauthenticated responses may differ slightly from this envelope (401).
  Treat any non-2xx as failure; prefer "message" when present.


Shared types
------------

Project:
  {
    "id": string,                          // uuid
    "tenantId": string,
    "name": string,
    "status": "DRAFT" | "ACTIVE" | "ARCHIVED",
    "speciesId": string | null,
    "primarySpeciesBotanical": string | null,
    "primarySpeciesCommon": string | null,
    "createdById": string,
    "createdAt": string,                   // ISO-8601
    "updatedAt": string
  }

  List endpoint also includes:
    "_count": { "documents": number }

Document (serialized — what list/get/init/complete return):
  {
    "id": string,                          // uuid
    "originalFilename": string,
    "mimeType": string,
    "sizeBytes": number,
    "documentType": DocumentType,
    "status": DocumentStatus,
    "failureReason": string | null,
    "uploadedAt": string | null,           // ISO-8601, set after complete
    "createdAt": string,
    "pageCount": number | undefined        // present on list and get
  }

DocumentStatus:
  "PENDING_UPLOAD"   // init-upload issued; file not yet PUT + completed
  "PROCESSING"       // object verified; text extraction running
  "READY"            // pages extracted; file is usable
  "FAILED"           // PUT missing, size mismatch, or extraction error

  Note: schema also has UPLOADED; current flow skips it (PENDING_UPLOAD → PROCESSING → READY | FAILED).

DocumentType (optional hint for later AI; does not block upload):
  "SIGNED_CONTRACT"
  "DRAFT_CONTRACT"
  "CONTRACT_ANNEX"
  "IP_CERTIFICATE"
  "EMAIL"
  "PROTOCOL_DOCUMENT"
  "VCU_EVALUATION"
  "PLANTING_PLAN"
  "MEETING_NOTES"
  "QUALITY_SPECIFICATION"
  "SOIL_ANALYSIS"
  "OTHER"              // default if omitted or unrecognised

Allowed file types (by MIME or extension):
  PDF, DOCX, XLSX, XLS, TXT, CSV, EML
  Max size: 50 MB per file (NUBRED_MAX_UPLOAD_BYTES)
  .doc is NOT accepted — convert to .docx first.

  MIME map:
    application/pdf
    application/vnd.openxmlformats-officedocument.wordprocessingml.document
    application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    application/vnd.ms-excel
    text/plain
    text/csv
    message/rfc822

  If browser File.type is empty, backend infers MIME from the filename extension.


Who can call what
-----------------
  Create project / list projects:
    Any authenticated user. First creator of an empty tenant is auto-joined as a tenant member.

  View project / list documents / get document / download / GET section review:
    Project creator OR an ACTIVE project member.

  init-upload / complete / delete / PATCH fields / PATCH review-state / POST confirm / POST chat:
    Project creator OR an ACTIVE VARIETY_MANAGER on that project.


Upload flow (implement this exactly)
------------------------------------
  Files never pass through the NuBred API. The browser PUTs bytes to a
  short-lived MinIO/S3 URL.

  Per user action (one click, or one drag-and-drop of N files):

    1. POST /api/projects/:projectId/documents/init-upload
         body.files = metadata only (filename, mimeType, size, documentType)
         max 20 files per request
         returns one presigned PUT per file

    2. For each returned upload, PUT the raw File/Blob to upload.url
         - Use method PUT (not POST)
         - Send exactly the headers in upload.headers (Content-Type)
         - Body = the File object
         - Do NOT attach Authorization or X-Tenant-Slug to this PUT
         - Do NOT send credentials (cookies) to MinIO
         - Content-Type MUST match the mimeType used in init-upload
           (that value was baked into the signature)

    3. For each file, POST /api/projects/:projectId/documents/:documentId/complete
         after its PUT succeeds
         returns 202; extraction runs in the background

    4. Poll GET /api/projects/:projectId/documents/:documentId
         until status is READY or FAILED
         suggested interval: 1–2 seconds
         optional: ?includeText=true once READY if you need page text

  Multiple files in one drop:
    One init-upload with files.length = N
    Then N parallel PUTs
    Then N parallel completes
    Then poll each document independently (they finish at different times)

  Upload again later (second click, one more file):
    Call init-upload again with files: [that file]
    Same projectId. New Document rows. Previous READY files are unchanged.

  If user selects more than 20 files in one action:
    Chunk into batches of 20 init-upload calls.


Frontend implementation notes
-----------------------------
  - Use file.size from the File object as size. complete verifies stored size
    against this declared size; a mismatch marks the document FAILED.
  - Prefer file.type; if empty, still send it (backend falls back to extension).
  - Show per-file status in the UI: pending → uploading → processing → ready | failed.
  - failureReason is human-readable when status is FAILED.
  - Presigned PUT URLs expire (default 15 minutes). Complete before expiry.
  - MinIO CORS must include the frontend origin (dev default includes
    http://localhost:5173). Browser PUT will fail with a CORS error if the
    origin is missing — that is a storage CORS issue, not an API 4xx.
  - After complete, GET list documents to refresh the project file list.
  - When every needed file is READY, POST /api/projects/:projectId/extractions
    and poll GET .../extractions/latest?includePayload=true. Render each section
    as it SUCCEEDS (contract first). Field mapping for review screens:
    docs/api/frontend-extraction-ui.md
    After a section is SUCCEEDED, review/edit/confirm:
    docs/api/review.md
    Section chatbot (conflict / missing / usual / source / apply):
    docs/api/chat.md


Typical sequence for a new project
----------------------------------
  1. POST /api/projects                  → save project.id
  2. Upload files as described above
  3. GET /api/projects/:projectId        → documentsByStatus
  4. GET /api/projects/:projectId/documents
  5. POST /api/projects/:projectId/extractions   → start AI analysis (all READY docs)
  6. Poll GET .../extractions/latest?includePayload=true every 2–3s
     Render contract as soon as that section is SUCCEEDED; keep polling until
     extraction.status is SUCCEEDED | PARTIAL | FAILED.
  7. For each SUCCEEDED section, GET /api/projects/:projectId/sections/:sectionKey
     PATCH fields as the VM edits; PATCH review-state { gapsTabViewed: true } on
     the Contract Gaps tab; POST .../sections/:sectionKey/confirm when
     rules.canConfirm. See docs/api/review.md.
     Chatbot: docs/api/chat.md (conflict RESOLVE posts immediately; missing RESOLVE is static until the user types or uploads).
  8. Project detail (after phase confirm): GET /api/projects/:projectId → phases[]
     for the world map (`countries` ISO alpha-2). Empty until phase is confirmed.
