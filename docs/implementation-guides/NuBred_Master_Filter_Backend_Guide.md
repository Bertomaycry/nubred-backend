# Master Filter module — backend implementation guide

Audience: the agent working in the NuBred **backend** repo.
Companion to `NuBred_Client_Module_Backend_Guide.html` and `docs/api/frontend-client-management.md`. Same conventions apply unless this file says otherwise.

The admin UI for this module is finished and runs on sample data. This guide defines the API it will call. The work is mostly CRUD, plus one upload flow and one "promote suggestion" action.

---

## 0. TL;DR for the implementing agent

1. Add two tables to the **platform** database (`nubred_platform`): `master_filters` and `user_filters`. Add a third, `filter_uploads`, to track presigned uploads.
2. Use a fixed catalog of **11 sections**. Section keys are fixed in code and are not a table.
3. Admin routes are under `/api/admin/master-filters`. They require `user.role === "admin"`, and `X-Tenant-Slug` is **not** sent.
4. Tenant routes are under `/api/master-filters`. They use `X-Tenant-Slug` and let client users submit **user filters**, which are suggestions.
5. File bytes never pass through the API. Use init-upload, a presigned PUT, then complete, as the projects/documents flow does.
6. On complete, the server extracts plain text from the file and stores it in `content`. From then on, `content` is the source of truth. Edits change `content` only.
7. Delete is a hard delete. The UI says "deleted permanent and unable to restore".
8. "Add to Master Filter" copies a pending user filter into a new master filter and marks the suggestion `ACCEPTED`.
9. Raise the JSON body limit for `PATCH /api/admin/master-filters/:filterId`. The global 50 KB limit is too small for filter content.
10. Use the response envelope `{ success, data, message? }`. Errors are `{ success: false, message }`.

---

## 1. Concepts

| Term | Meaning |
|---|---|
| **Section** | An extraction area of a project, such as Contract or Genotype. Fixed list of 11. |
| **Master filter** | A text/markdown instruction file uploaded and owned by NuBred admins. It tells the AI what to extract for a section. A section can have **0..N** master filters. |
| **User filter** (UI label "User Filter", also called "Suggestion") | A filter file submitted by a client user from a tenant workspace. The admin reviews it and can promote it into a master filter. |
| **Promote** | The admin action "Add to Master Filter". It creates a new master filter from a user filter's content. |

Master filters are **global to the platform**. They are not per client, and they do not depend on a client's module flags.

---

## 2. Section catalog (hard-code this)

Keys are snake_case. They are also the path params. The frontend switches its route ids to these keys when it integrates.

Order matters. The admin list renders in this order.

| # | `key` | `title` | Extraction `sectionKey` today |
|---|---|---|---|
| 1 | `contract` | Contract | `contract` |
| 2 | `genotype` | Genotype | `genotype` |
| 3 | `ip_right` | IP Right | — |
| 4 | `quarantine` | Quarantine | — |
| 5 | `supply_chain` | Supply Chain | — |
| 6 | `timeline` | Timeline | `chronology` |
| 7 | `todo` | To Do | — |
| 8 | `protocol` | Protocol | `protocol` |
| 9 | `observation` | Observation | — |
| 10 | `phase` | Phase | `phase` |
| 11 | `project_overview` | Project Overview | — |

The last column shows which existing extraction pipeline section, if any, will consume the filter later. Section 11 covers that. CRUD does not depend on it.

Any other key returns `400` `Unknown section.`

Suggested code:

```ts
export const MASTER_FILTER_SECTIONS = [
  { key: "contract", title: "Contract" },
  { key: "genotype", title: "Genotype" },
  { key: "ip_right", title: "IP Right" },
  { key: "quarantine", title: "Quarantine" },
  { key: "supply_chain", title: "Supply Chain" },
  { key: "timeline", title: "Timeline" },
  { key: "todo", title: "To Do" },
  { key: "protocol", title: "Protocol" },
  { key: "observation", title: "Observation" },
  { key: "phase", title: "Phase" },
  { key: "project_overview", title: "Project Overview" },
] as const;

export type MasterFilterSectionKey = (typeof MASTER_FILTER_SECTIONS)[number]["key"];
```

---

## 3. Data model (platform DB)

Prisma-style. Adjust names to the repo's conventions. Store everything in `nubred_platform`, **not** in tenant databases. A user filter keeps `tenantId` so the admin can see which client sent it.

```prisma
enum UserFilterStatus {
  PENDING   // shown in admin "User Filter" list, counted as a suggestion
  ACCEPTED  // promoted to a master filter
  DISMISSED // reserved; no UI yet
}

enum FilterUploadKind {
  MASTER
  USER
}

enum FilterUploadStatus {
  PENDING_UPLOAD
  COMPLETED
  FAILED
  EXPIRED
}

model MasterFilter {
  id                 String   @id @default(uuid())
  sectionKey         String   // one of MASTER_FILTER_SECTIONS keys
  fileName           String   // original name, sanitized, max 255
  mimeType           String
  sizeBytes          Int
  storageKey         String   // object key of the original upload
  content            String   @db.Text // extracted / edited text; source of truth
  version            Int      @default(1) // bump on every content edit
  sourceUserFilterId String?  @unique // set when promoted from a suggestion
  createdById        String   // platform user id (admin)
  updatedById        String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([sectionKey, createdAt])
}

model UserFilter {
  id                      String           @id @default(uuid())
  sectionKey              String
  tenantId                String           // FK to tenants (platform)
  submittedByUserId       String           // platform user id of the client user
  fileName                String
  mimeType                String
  sizeBytes               Int
  storageKey              String
  content                 String           @db.Text
  status                  UserFilterStatus @default(PENDING)
  promotedMasterFilterId  String?
  reviewedById            String?          // admin who promoted/dismissed
  reviewedAt              DateTime?
  createdAt               DateTime         @default(now())
  updatedAt               DateTime         @updatedAt

  @@index([sectionKey, status, createdAt])
  @@index([tenantId, createdAt])
}

model FilterUpload {
  id            String             @id @default(uuid())
  kind          FilterUploadKind
  sectionKey    String
  tenantId      String?            // set for USER uploads
  createdById   String
  fileName      String
  mimeType      String
  declaredSize  Int
  storageKey    String
  status        FilterUploadStatus @default(PENDING_UPLOAD)
  failureReason String?
  expiresAt     DateTime
  createdAt     DateTime           @default(now())
}
```

Notes:

- `content` holds plain text. Markdown stays as written. PDF and DOCX become extracted text.
- `version` gives optimistic locking on edits (section 6.6).
- The original object stays in storage until the filter is deleted. It is never re-read after complete.
- Do **not** soft-delete master filters. Section 6.7 explains why.

---

## 4. Storage

| Kind | Bucket | Key pattern |
|---|---|---|
| Master filter | platform bucket (e.g. `nubred-platform`) | `master-filters/{sectionKey}/{uploadId}/{sanitizedFileName}` |
| User filter | that client's bucket `nubred-{slug}` | `user-filters/{sectionKey}/{uploadId}/{sanitizedFileName}` |

The API reads user filter objects with its own credentials. The admin never needs access to the client bucket.

If the platform bucket does not exist yet, create it at startup (idempotent), the same way the client module creates tenant buckets. The bucket is private.

Presigned PUT URLs expire after 15 minutes, the same default as documents. Run a cleanup job, hourly is fine, that:

- sets `FilterUpload` rows older than `expiresAt` that are still `PENDING_UPLOAD` to `EXPIRED`
- deletes their objects if any were written

---

## 5. Auth, headers, envelope

### Admin routes `/api/admin/master-filters/**`

- Require a Clerk session and `user.role === "admin"`. Use the same middleware as `/api/admin/clients`.
- Otherwise return `403` `Not authorized as an admin`.
- Do **not** read or require `X-Tenant-Slug`. The frontend axios interceptor already strips it for `/admin/clients`, and it will add `/admin/master-filters` to that rule.

### Tenant routes `/api/master-filters/**`

- Require a Clerk session and an active tenant from `X-Tenant-Slug` or the subdomain, as on other tenant routes.
- A restricted (inactive) tenant is rejected the same way as on its other routes.
- Default submitters are client roles `owner`, `master_project_manager`, and `project_manager`. Others get `403` `You do not have permission to submit filters.` See open question Q3.

### Envelope

Success:

```json
{ "success": true, "data": { }, "message": "Optional toast text" }
```

Error:

```json
{ "success": false, "message": "Human readable text" }
```

The frontend toasts `message`. Every timestamp is an ISO-8601 UTC string. The frontend formats it as `22 Oct 2026`.

---

## 6. Admin API

Paths are relative to the API origin. `VITE_BASE_URL` already ends in `/api`, so the frontend calls `/admin/master-filters/...`.

### 6.0 Shared response shapes

`SectionSummary`

```json
{
  "key": "contract",
  "title": "Contract",
  "masterFilterCount": 1,
  "suggestionCount": 10
}
```

`suggestionCount` is the number of user filters with status `PENDING` in that section.

`FilterListItem` (cards, no content)

```json
{
  "id": "uuid",
  "sectionKey": "contract",
  "fileName": "MasterFilterContract_01.md",
  "mimeType": "text/markdown",
  "sizeBytes": 18234,
  "createdAt": "2026-10-22T09:14:00.000Z",
  "updatedAt": "2026-10-22T09:14:00.000Z",
  "uploadedBy": {
    "kind": "admin",
    "displayName": "NuBred Admin",
    "isCurrentUser": true,
    "clientId": null,
    "clientName": null
  }
}
```

For a user filter, `uploadedBy.kind` is `"client"`, `clientId` and `clientName` are filled in (for example "Agritech Corporation"), and `isCurrentUser` is `false`.

The card subtitle is built as follows:

- `kind === "admin" && isCurrentUser` gives "Uploaded by you (Admin)"
- `kind === "admin"` gives "Uploaded by {displayName} (Admin)"
- `kind === "client"` gives "{clientName}"

`MasterFilter` (detail, used by preview)

`MasterFilter` is `FilterListItem` plus:

```json
{
  "content": "# Master Filter — Contract — v0.10 …",
  "version": 3,
  "sourceUserFilterId": null
}
```

`UserFilter` (detail, used by preview)

`UserFilter` is `FilterListItem` plus:

```json
{
  "content": "## 1. Purpose …",
  "status": "PENDING",
  "promotedMasterFilterId": null
}
```

---

### 6.1 List sections

`GET /api/admin/master-filters/sections`

Response `200`. It always contains all 11 sections in catalog order, including those with zero counts.

```json
{
  "success": true,
  "data": [
    { "key": "contract", "title": "Contract", "masterFilterCount": 1, "suggestionCount": 10 },
    { "key": "genotype", "title": "Genotype", "masterFilterCount": 0, "suggestionCount": 0 }
  ]
}
```

Implementation: two `GROUP BY sectionKey` count queries, merged into the catalog.

---

### 6.2 Section detail (both lists)

`GET /api/admin/master-filters/sections/:sectionKey`

Response `200`:

```json
{
  "success": true,
  "data": {
    "section": { "key": "contract", "title": "Contract", "masterFilterCount": 1, "suggestionCount": 10 },
    "masterFilters": [ FilterListItem ],
    "userFilters": [ FilterListItem ]
  }
}
```

- `masterFilters`: every master filter in the section, sorted by `createdAt` ascending (oldest first).
- `userFilters`: only `PENDING`, sorted by `createdAt` descending (newest first).
- No `content` in this response. Content can be large, and the preview loads it per item.
- There is no pagination for now. The UI renders a grid. Section 13 covers adding it later.

Errors: `400` `Unknown section.`

---

### 6.3 Get one master filter (preview)

`GET /api/admin/master-filters/:filterId`

Response `200` with `data: MasterFilter`.

Errors: `404` `Master filter not found.`

---

### 6.4 Get one user filter (preview)

`GET /api/admin/master-filters/user-filters/:userFilterId`

Response `200` with `data: UserFilter`. This returns any status, so an already-accepted suggestion can still be opened.

Errors: `404` `Suggestion not found.`

Route order matters. Register `/user-filters/:id` and `/sections/**` before `/:filterId`, or validate `filterId` as a UUID.

---

### 6.5 Upload a master filter (the "Add Master Filter" modal)

This is a three-step flow. The frontend wraps all three steps in the modal's `onUpload(file)`.

#### Step 1. Init

`POST /api/admin/master-filters/sections/:sectionKey/uploads`

```json
{ "fileName": "MasterFilterContract_02.md", "mimeType": "text/markdown", "size": 18234 }
```

Validation runs in this order, and the first failure becomes `message`:

| Rule | Status | `message` |
|---|---|---|
| Unknown `sectionKey` | 400 | `Unknown section.` |
| `fileName` missing / blank | 400 | `File name is required.` |
| Extension not in `.md .txt .pdf .docx` | 400 | `Use a .md, .txt, .pdf, or .docx file.` |
| `size` not a positive integer | 400 | `File size is required.` |
| `size > 5 MB` (5 × 1024 × 1024) | 400 | `File is larger than 5 MB.` |

Accepted MIME types:

| Ext | MIME |
|---|---|
| `.md` | `text/markdown` (also accept `text/x-markdown`, `text/plain`, `""`) |
| `.txt` | `text/plain` |
| `.pdf` | `application/pdf` |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |

Browsers often send `.md` files with an empty `type`. The extension decides the type, and an empty or odd `mimeType` falls back to the extension's MIME. Store and sign with the **normalized** MIME, and return it in `headers` so the PUT matches the signature.

`fileName` sanitization: strip path separators and control characters, trim, and cap at 255 characters. Keep the original casing for display.

Response `201`:

```json
{
  "success": true,
  "data": {
    "uploadId": "uuid",
    "upload": {
      "url": "https://minio…signed",
      "method": "PUT",
      "headers": { "Content-Type": "text/markdown" }
    },
    "expiresAt": "2026-10-31T10:15:00.000Z"
  }
}
```

#### Step 2. PUT

The browser PUTs the raw file to `upload.url` with exactly `upload.headers`. It sends no Authorization header and no cookies. Platform bucket CORS must allow the admin origins (`http://localhost:5173`, `https://gov.nubred.com`).

#### Step 3. Complete

`POST /api/admin/master-filters/uploads/:uploadId/complete`

No body.

The server does the following:

1. Load the `FilterUpload`. It must be `kind = MASTER`, `PENDING_UPLOAD`, and not expired.
2. `HEAD` the object. It must exist and its size must equal `declaredSize`.
3. Extract text (section 8). Trim the result. It must not be empty.
4. In one transaction, create a `MasterFilter` with `version = 1` and `createdById` set to the admin, and set the upload to `COMPLETED`.
5. Return the created filter.

Response `201`:

```json
{ "success": true, "message": "Master filter added.", "data": MasterFilter }
```

Errors. On any failure after step 1, set the upload to `FAILED` with `failureReason`, and delete the object.

| Case | Status | `message` |
|---|---|---|
| Upload id unknown | 404 | `Upload not found.` |
| Already completed | 409 | `This upload was already completed.` |
| Expired | 410 | `This upload expired. Please upload the file again.` |
| Object missing | 400 | `The file did not finish uploading. Please try again.` |
| Size mismatch | 400 | `The uploaded file does not match its declared size.` |
| Text extraction failed / empty | 422 | `We could not read any text from this file.` |
| Content over limit (section 6.6) | 422 | `This file has too much text. The limit is 1,000,000 characters.` |

Complete runs synchronously. Files are at most 5 MB, so text extraction should finish in a few seconds. Give this route a server timeout of at least 60 s. The UI shows a progress bar until complete returns. On rejection, it shows the failure message with a retry button, and the retry repeats all three steps with a new upload.

---

### 6.6 Edit a master filter (Save)

`PATCH /api/admin/master-filters/:filterId`

```json
{ "content": "…full new text…", "version": 3 }
```

| Rule | Status | `message` |
|---|---|---|
| Not found | 404 | `Master filter not found.` |
| `content` missing / not a string | 400 | `Content is required.` |
| `content.trim()` empty | 400 | `Content cannot be empty.` |
| `content.length > 1_000_000` | 400 | `Content is too long. The limit is 1,000,000 characters.` |
| `version` missing / not an integer | 400 | `Version is required.` |
| `version !== current.version` | 409 | `This master filter was changed by someone else. Reload it and try again.` |

On success:

- Set `content`, increment `version` by 1, and set `updatedById` (`updatedAt` updates automatically).
- Use `UPDATE … WHERE id = ? AND version = ?` and check the affected row count. That makes the version check atomic.
- `fileName` is **not** editable, and the stored original object is not rewritten.

Response `200`:

```json
{ "success": true, "message": "Master filter updated.", "data": MasterFilter }
```

**Body limit:** the global JSON limit is 50 KB. Mount this route with its own limit, `express.json({ limit: "2mb" })`, before the global parser applies, or exclude it from the global parser. 1,000,000 characters of UTF-8 can approach 2–3 MB in the worst case (multi-byte characters), so `3mb` is the safer setting. Choose one and keep the character cap above.

The UI flow is as follows. Edit opens a textarea. Cancel or closing with unsaved text shows a "leave?" confirm on the client only. Save calls this route and then shows the "Master Filter Updated!" modal. The client keeps the returned `version` for the next save.

---

### 6.7 Delete a master filter

`DELETE /api/admin/master-filters/:filterId`

- Hard delete the row.
- Delete the stored object (best effort). Log storage errors, but do not fail the request because of them.
- If `sourceUserFilterId` is set, leave that user filter as `ACCEPTED`. Its history stays, and it does not return to pending.

Response `200`:

```json
{ "success": true, "message": "Master filter deleted." }
```

Errors: `404` `Master filter not found.`

The last master filter in a section can be deleted. The section shows its empty state, "No Master Filter to Shown".

---

### 6.8 Promote a user filter ("Add to Master Filter")

`POST /api/admin/master-filters/user-filters/:userFilterId/promote`

No body.

Do the following in one transaction:

1. Load the user filter. It must be `PENDING`.
2. Create a `MasterFilter` in the **same section** with the same `fileName`, `mimeType`, `sizeBytes`, and `content`. Set `sourceUserFilterId` to the user filter, `createdById` to the admin, and `version` to 1.
   - `storageKey`: copy the object into the platform bucket under `master-filters/{sectionKey}/promoted-{userFilterId}/{fileName}`. The master filter then never depends on a client bucket that might be removed later. If the copy fails, abort and return 500.
3. Set the user filter to `ACCEPTED`, with `promotedMasterFilterId`, `reviewedById`, and `reviewedAt`.

Response `201`:

```json
{
  "success": true,
  "message": "This suggestion has been added to master filter",
  "data": { "masterFilter": MasterFilter, "userFilter": UserFilter }
}
```

Errors:

| Case | Status | `message` |
|---|---|---|
| Not found | 404 | `Suggestion not found.` |
| Not `PENDING` | 409 | `This suggestion was already added to the master filter.` |

After success, the frontend closes the preview, refetches the section, and invalidates the sections list. The suggestion leaves the User Filter list, and both counts change.

---

### 6.9 (Optional, no UI yet) Dismiss a user filter

`POST /api/admin/master-filters/user-filters/:userFilterId/dismiss` sets the status to `DISMISSED`. Ship it only if it costs almost nothing. The UI does not call it yet.

---

## 7. Tenant API (user filter submission)

Suggestions come from client workspaces. **The tenant-side UI is not built yet**, but these routes must exist for the admin "User Filter" list to have real data. Until the UI exists, seed data (section 12) fills the list.

Headers: `Authorization` plus `X-Tenant-Slug`, as on other tenant routes.

### 7.1 Init

`POST /api/master-filters/sections/:sectionKey/suggestions/uploads`

The body and validation are the same as 6.5 step 1. The `FilterUpload` gets `kind = USER` and `tenantId` from the tenant context. Storage goes to the tenant bucket (section 4).

### 7.2 Complete

`POST /api/master-filters/suggestions/uploads/:uploadId/complete`

The steps are the same as 6.5 step 3, except that it creates a `UserFilter` with `PENDING`, `tenantId`, and `submittedByUserId`. The upload must belong to the caller's tenant. Otherwise it returns `404` `Upload not found.`

Response `201`: `{ success, message: "Suggestion submitted.", data: UserFilter }`

### 7.3 List my tenant's suggestions

`GET /api/master-filters/suggestions?sectionKey=contract`

This returns this tenant's user filters (all statuses) as `FilterListItem` plus `status`, newest first. `sectionKey` is optional.

### 7.4 Withdraw a pending suggestion

`DELETE /api/master-filters/suggestions/:userFilterId`

- The filter must belong to the caller's tenant and be `PENDING`.
- The submitter or the client `owner` can withdraw it.
- Hard delete the row and the object.

Errors: `404` `Suggestion not found.` / `409` `This suggestion was already reviewed.`

### 7.5 Read the active master filter (optional, later)

`GET /api/master-filters/sections/:sectionKey` would return the master filters' content read-only, if the tenant UI ever shows the current rules. It is not needed now.

---

## 8. Text extraction

| Ext | How |
|---|---|
| `.md`, `.txt` | Decode as UTF-8. Strip a BOM. Normalize `\r\n` to `\n`. |
| `.pdf` | Reuse the text extractor that the documents pipeline already uses. Join pages with `\n\n`. |
| `.docx` | Reuse the existing DOCX extractor (e.g. mammoth raw text). Keep paragraph breaks. |

After extraction:

- `trim()` the text. If it is empty, return `422` (section 6.5).
- Cap at 1,000,000 characters. Above the cap, return `422`. Do not truncate silently.
- Do not try to convert PDF or DOCX to rich markdown. Plain text is fine, because admins edit in a plain textarea.

---

## 9. Frontend wiring map (for reference)

| UI action | Call |
|---|---|
| Master Filter list page load | `GET /admin/master-filters/sections` |
| Click a section card | `GET /admin/master-filters/sections/:key` |
| Click Preview (master) | `GET /admin/master-filters/:id` |
| Click Preview (user) | `GET /admin/master-filters/user-filters/:id` |
| Add Master Filter modal → choose / drop file | 6.5 init, then PUT, then complete |
| Upload failed → retry | Full 6.5 again |
| Preview menu → Edit → Save | `PATCH /admin/master-filters/:id` `{ content, version }` |
| Preview menu → Delete → "Yes, Delete" | `DELETE /admin/master-filters/:id` |
| User preview → Add to Master Filter → Complete | `POST /admin/master-filters/user-filters/:id/promote` |

React Query keys the frontend will use: `["admin-master-filter-sections"]`, `["admin-master-filter-section", key]`, and `["admin-master-filter", id]`. Each mutation invalidates the section key and the sections list.

---

## 10. Error message catalog (exact strings)

| Status | `message` |
|---|---|
| 400 | `Unknown section.` |
| 400 | `File name is required.` |
| 400 | `Use a .md, .txt, .pdf, or .docx file.` |
| 400 | `File size is required.` |
| 400 | `File is larger than 5 MB.` |
| 400 | `The file did not finish uploading. Please try again.` |
| 400 | `The uploaded file does not match its declared size.` |
| 400 | `Content is required.` |
| 400 | `Content cannot be empty.` |
| 400 | `Content is too long. The limit is 1,000,000 characters.` |
| 400 | `Version is required.` |
| 403 | `Not authorized as an admin` |
| 403 | `You do not have permission to submit filters.` |
| 404 | `Master filter not found.` |
| 404 | `Suggestion not found.` |
| 404 | `Upload not found.` |
| 409 | `This upload was already completed.` |
| 409 | `This master filter was changed by someone else. Reload it and try again.` |
| 409 | `This suggestion was already added to the master filter.` |
| 409 | `This suggestion was already reviewed.` |
| 410 | `This upload expired. Please upload the file again.` |
| 422 | `We could not read any text from this file.` |
| 422 | `This file has too much text. The limit is 1,000,000 characters.` |

Success `message` values: `Master filter added.`, `Master filter updated.`, `Master filter deleted.`, `This suggestion has been added to master filter`, `Suggestion submitted.`

---

## 11. How filters reach the AI (follow-up, not part of CRUD)

The UI copy says an updated master filter "affected the project creation process". CRUD does not need this wired. When it is wired, expose one internal function and call it from the extraction pipeline:

```ts
getActiveFilterText(sectionKey: MasterFilterSectionKey): Promise<string | null>
```

It concatenates the section's master filters, ordered by `createdAt` ascending, each prefixed with its `fileName`, and returns `null` when there are none. Map extraction keys through the section 2 table (`chronology` reads `timeline`).

Precedence comes from the sample master filter itself. Core rules in code run first, and filters cannot override them. The master filter comes next. Read the filter at the **start of each extraction run** and record `version` and ids on the run, so a result can always be traced to the filter text that produced it. Never cache the text across runs.

Whether a tenant's own user filter also applies to that tenant's extractions is undecided (Q1). Do not apply user filters until that is answered.

---

## 12. Seed data (dev only)

Add a seed or script that does the following:

- creates one master filter in `contract`, with `fileName` `MasterFilterContract_01.md`, created by the first admin user, with any multi-line sample text
- creates ten `PENDING` user filters in `contract`, named `UserFilterContract_01.md` through `_10.md`, for the `test` tenant (or the first tenant)

The admin pages then look like the current sample UI without the tenant UI. Seed rows may use a placeholder `storageKey`, or upload a tiny object.

---

## 13. Non-goals / later

- Pagination of user filters (add `?page&limit`, same shape as the clients list, when counts grow)
- Version history or restore (the UI says delete is permanent; edits overwrite)
- Renaming a master filter
- Reordering master filters
- Dismiss UI (6.9)
- Tenant-side screens (section 7 routes exist first)
- Notifications to the client when their suggestion is accepted

---

## 14. Acceptance checklist

- [ ] All three tables are migrated in the platform DB, and the platform bucket is created idempotently.
- [ ] `GET sections` always returns 11 sections in order, with correct counts (pending suggestions only).
- [ ] Section detail lists master filters oldest first and pending suggestions newest first, without content.
- [ ] Unknown section key returns `400 Unknown section.` on every route that takes one.
- [ ] Upload accepts `.md` with an empty browser MIME and normalizes it, so the PUT signature matches.
- [ ] Upload rejects a 5 MB + 1 byte file at init.
- [ ] Complete rejects a missing object, a size mismatch, empty text, and expired or duplicate completes, with the exact messages above.
- [ ] Complete on a failed upload deletes the object.
- [ ] PATCH accepts a large body (at least 1,000,000 characters) despite the global 50 KB limit.
- [ ] PATCH with a stale `version` returns 409 and does not change the row.
- [ ] DELETE removes the row and the object, and a second DELETE returns 404.
- [ ] Promote copies content and the object into the platform bucket, creates the master filter, marks the suggestion `ACCEPTED`, and a second promote returns 409.
- [ ] All admin routes return 403 for a non-admin and ignore `X-Tenant-Slug`.
- [ ] Tenant routes scope everything to the caller's tenant, and another tenant's upload or suggestion id returns 404.
- [ ] The cleanup job expires stale `PENDING_UPLOAD` rows.
- [ ] Integration tests cover each table row in section 10.

---

## 15. Open questions (answer before or during implementation)

| # | Question | Default in this guide |
|---|---|---|
| Q1 | Does a tenant's user filter also apply to that tenant's own extractions, as a "should" override? The sample text suggests it might. | No. Suggestions only. |
| Q2 | Can a section have more than one master filter, and if so, are all of them sent to the AI? | Yes, multiple are allowed, and all are concatenated oldest first. |
| Q3 | Which client roles can submit suggestions? | `owner`, `master_project_manager`, `project_manager` |
| Q4 | Does a promoted suggestion stay visible somewhere in admin? | No. It leaves the list, but the row is kept as `ACCEPTED`. |
| Q5 | Should deleting a master filter that was promoted reset the suggestion to pending? | No. |
| Q6 | Do sections `ip_right`, `quarantine`, `supply_chain`, `todo`, `observation`, and `project_overview` have extraction pipelines yet? | Not yet. Filters can be stored now and are consumed later. |
