# Master Filter — frontend integration

Copy this file into the frontend repo. It is the contract for replacing the admin Master Filter sample data with live API calls. Tenant-side suggestion UI is **not** built yet; those routes are documented at the end so a later agent can wire them without guessing.

`VITE_BASE_URL` already ends in `/api`. Paths below are relative to that (same style as `/admin/clients`).

Envelope on every JSON response:

```json
{ "success": true, "data": {}, "message": "Optional toast text" }
```

Error:

```json
{ "success": false, "message": "Human readable text" }
```

Toast `message`. Every timestamp is ISO-8601 UTC. Format in the UI as `22 Oct 2026`.

---

## 0. Do this first (axios)

The interceptor that **strips `X-Tenant-Slug` on `/admin/clients`** must also strip it on `/admin/master-filters`. Admin routes ignore the header; sending it is wrong.

Keep sending it on `/master-filters/**` (tenant workspace). Do **not** send it on `/admin/master-filters/**`.

Auth: Clerk Bearer token, same as clients. Non-admin → `403` `Not authorized as an admin`.

Do not send a tenant id, database name, or bucket name. File bytes never go through this API.

---

## 1. Section keys (replace the sample route ids)

Hard-coded. Unknown key → `400` `Unknown section.` Order is the admin list order.

| # | `key` (path param) | `title` |
|---|---|---|
| 1 | `contract` | Contract |
| 2 | `genotype` | Genotype |
| 3 | `ip_right` | IP Right |
| 4 | `quarantine` | Quarantine |
| 5 | `supply_chain` | Supply Chain |
| 6 | `timeline` | Timeline |
| 7 | `todo` | To Do |
| 8 | `protocol` | Protocol |
| 9 | `observation` | Observation |
| 10 | `phase` | Phase |
| 11 | `project_overview` | Project Overview |

Switch any camelCase / slug sample ids (`ipRight`, `supply-chain`, `projectOverview`, …) to these snake_case keys.

---

## 2. Shared shapes

`SectionSummary`

```json
{
  "key": "contract",
  "title": "Contract",
  "masterFilterCount": 1,
  "suggestionCount": 10
}
```

`suggestionCount` = user filters with status `PENDING` only.

`FilterListItem` (cards — **no** `content`)

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

Card subtitle:

- `kind === "admin" && isCurrentUser` → `Uploaded by you (Admin)`
- `kind === "admin"` → `Uploaded by {displayName} (Admin)`
- `kind === "client"` → `{clientName}` (e.g. `Agritech Corporation`)

For a user-filter card, `uploadedBy.kind` is `"client"` and `clientId` / `clientName` are set. `isCurrentUser` is false on admin screens.

`MasterFilter` = `FilterListItem` plus:

```json
{ "content": "# Master Filter — Contract …", "version": 3, "sourceUserFilterId": null }
```

`UserFilter` = `FilterListItem` plus:

```json
{ "content": "## 1. Purpose …", "status": "PENDING", "promotedMasterFilterId": null }
```

`status`: `PENDING` | `ACCEPTED` | `DISMISSED`. Admin User Filter list only shows `PENDING`. After promote the row stays `ACCEPTED` but leaves the list.

---

## 3. React Query keys

| Key | Fetched by |
|---|---|
| `["admin-master-filter-sections"]` | `GET /admin/master-filters/sections` |
| `["admin-master-filter-section", sectionKey]` | `GET /admin/master-filters/sections/:sectionKey` |
| `["admin-master-filter", filterId]` | `GET /admin/master-filters/:filterId` |
| `["admin-user-filter", userFilterId]` | `GET /admin/master-filters/user-filters/:userFilterId` |

After **every** mutation (upload complete, save, delete, promote): invalidate the section key **and** the sections list. After save, also set the returned `version` on the open preview cache.

---

## 4. Admin API map

| UI action | Call |
|---|---|
| Master Filter list page load | `GET /admin/master-filters/sections` |
| Click a section card | `GET /admin/master-filters/sections/:key` |
| Click Preview (master) | `GET /admin/master-filters/:id` |
| Click Preview (user) | `GET /admin/master-filters/user-filters/:id` |
| Add Master Filter modal → choose / drop file | init → PUT → complete (below) |
| Upload failed → retry | Full three-step again (new `uploadId`) |
| Preview menu → Edit → Save | `PATCH /admin/master-filters/:id` `{ content, version }` |
| Preview menu → Delete → "Yes, Delete" | `DELETE /admin/master-filters/:id` |
| User preview → Add to Master Filter → Complete | `POST /admin/master-filters/user-filters/:id/promote` |

There is **no pagination**. Both lists are the full arrays.

---

### 4.1 List sections

`GET /admin/master-filters/sections`

`200` `data` is always **all 11** sections in catalog order, including zeros.

---

### 4.2 Section detail (both grids)

`GET /admin/master-filters/sections/:sectionKey`

```json
{
  "success": true,
  "data": {
    "section": { "key": "contract", "title": "Contract", "masterFilterCount": 1, "suggestionCount": 10 },
    "masterFilters": [ "FilterListItem" ],
    "userFilters": [ "FilterListItem" ]
  }
}
```

- `masterFilters`: oldest first (`createdAt` asc)
- `userFilters`: **PENDING only**, newest first
- No `content` here. Preview fetches per item.
- Empty master list → existing empty copy (`No Master Filter to Shown`). Deleting the last master filter is allowed.

`400` `Unknown section.`

---

### 4.3 Preview one master filter

`GET /admin/master-filters/:id` → `200` `data: MasterFilter`

`404` `Master filter not found.`

Keep `version` in component state. It is required on Save.

---

### 4.4 Preview one user filter

`GET /admin/master-filters/user-filters/:id` → `200` `data: UserFilter`

Works for any status (an already-accepted suggestion can still be opened if you have the id). The list will not show it.

`404` `Suggestion not found.`

---

### 4.5 Upload (Add Master Filter modal)

Files never pass through the API. Wrap all three steps in the modal `onUpload(file)`. Show a progress bar until step 3 returns. On failure, show `message` and a retry button that repeats **all three** steps with a new upload.

**Allowed:** `.md` `.txt` `.pdf` `.docx`. Max **5 MB** (`file.size`). Reject locally with the same copy the API uses if you want instant feedback; the server still enforces it.

Browsers often send `.md` with `file.type === ""`. Send that empty string. The server keys off the **extension** and returns the normalised MIME in `upload.headers`. The PUT **must** use those headers or the signature fails.

#### Step 1 — init

`POST /admin/master-filters/sections/:sectionKey/uploads`

```json
{ "fileName": "MasterFilterContract_02.md", "mimeType": "text/markdown", "size": 18234 }
```

Use `file.name`, `file.type` (may be `""`), `file.size`.

`201`

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

URL expires in 15 minutes. Do not persist it.

Init errors (`400`):

| `message` |
|---|
| `Unknown section.` |
| `File name is required.` |
| `Use a .md, .txt, .pdf, or .docx file.` |
| `File size is required.` |
| `File is larger than 5 MB.` |

#### Step 2 — PUT

`PUT upload.url` with **exactly** `upload.headers`. Body = the `File`.

- No `Authorization`
- No `X-Tenant-Slug`
- No cookies (`withCredentials: false`)
- Method is `PUT`, not `POST`
- `Content-Type` must match `upload.headers` (the value baked into the signature)

A CORS failure on this PUT is a storage CORS problem, not an API 4xx.

#### Step 3 — complete

`POST /admin/master-filters/uploads/:uploadId/complete`

No body. Can take several seconds (text extraction). Do not time the UI out under 60s.

`201`

```json
{ "success": true, "message": "Master filter added.", "data": MasterFilter }
```

Toast `Master filter added.` Then close the modal, invalidate section + sections list.

Complete errors:

| Status | `message` | UI |
|---|---|---|
| 404 | `Upload not found.` | retry all three |
| 409 | `This upload was already completed.` | treat as success / refetch |
| 410 | `This upload expired. Please upload the file again.` | retry all three |
| 400 | `The file did not finish uploading. Please try again.` | retry all three |
| 400 | `The uploaded file does not match its declared size.` | retry all three |
| 422 | `We could not read any text from this file.` | retry with another file |
| 422 | `This file has too much text. The limit is 1,000,000 characters.` | retry with a smaller file |

---

### 4.6 Edit / Save

Edit is a textarea of `content`. Cancel / close with dirty text = client-only confirm. Save:

`PATCH /admin/master-filters/:filterId`

```json
{ "content": "…full new text…", "version": 3 }
```

This route allows a large JSON body (up to ~3 MB). Other routes stay at 50 KB. Do **not** send `fileName`. Do **not** re-upload the file.

`200` `{ success, message: "Master filter updated.", data: MasterFilter }`

Show the existing "Master Filter Updated!" modal. Replace local `version` with `data.version`.

| Status | `message` |
|---|---|
| 404 | `Master filter not found.` |
| 400 | `Content is required.` / `Content cannot be empty.` / `Content is too long. The limit is 1,000,000 characters.` / `Version is required.` |
| 409 | `This master filter was changed by someone else. Reload it and try again.` |

On 409: refetch the filter, drop local edits, tell the admin to retry.

---

### 4.7 Delete

`DELETE /admin/master-filters/:filterId`

Hard delete. The UI copy "deleted permanent and unable to restore" is correct. There is no restore.

`200` `{ success: true, message: "Master filter deleted." }`

`404` `Master filter not found.` (already gone — refetch the section).

If this master filter was promoted from a suggestion, that suggestion stays `ACCEPTED` and does **not** return to the User Filter list.

---

### 4.8 Promote ("Add to Master Filter")

`POST /admin/master-filters/user-filters/:userFilterId/promote`

No body.

`201`

```json
{
  "success": true,
  "message": "This suggestion has been added to master filter",
  "data": { "masterFilter": MasterFilter, "userFilter": UserFilter }
}
```

Toast that `message` (no period). Close the preview, refetch the section, invalidate the sections list. The suggestion leaves User Filter; both counts change.

`404` `Suggestion not found.`
`409` `This suggestion was already added to the master filter.` → refetch (another admin won).

Dismiss exists (`POST .../user-filters/:id/dismiss`) but **has no UI**. Do not call it.

---

## 5. Error catalog (exact strings)

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

Success toasts: `Master filter added.` / `Master filter updated.` / `Master filter deleted.` / `This suggestion has been added to master filter` / `Suggestion submitted.`

---

## 6. What not to do

- Do not send `X-Tenant-Slug` on admin master-filter calls.
- Do not PUT with Axios defaults (auth, tenant header, credentials).
- Do not edit `fileName` or rewrite the stored file. Only `content` + `version`.
- Do not truncate content. Cap is 1,000,000 characters; over = error.
- Do not paginate yet.
- Do not apply user filters to extraction. Suggestions only. Wiring filters into the AI is a later backend task.
- Do not build tenant suggestion screens unless asked. Routes below exist so the admin User Filter list can receive real data; until then, `node src/seeders/seedMasterFilters.js` fills contract with 1 master + 10 pending suggestions.

---

## 7. Tenant API (no UI yet)

Base: `/master-filters`. Headers: `Authorization` + `X-Tenant-Slug` (same as projects). Restricted / unready workspace is rejected like other tenant routes.

Submitters: client roles `owner`, `master_project_manager`, `project_manager`. Others → `403` `You do not have permission to submit filters.`

| Method | Path | Notes |
|---|---|---|
| POST | `/master-filters/sections/:sectionKey/suggestions/uploads` | Same body/validation as admin init. PUT goes to the **client** bucket. |
| POST | `/master-filters/suggestions/uploads/:uploadId/complete` | `201` `{ message: "Suggestion submitted.", data: UserFilter }`. Upload must belong to this tenant (else `404`). |
| GET | `/master-filters/suggestions?sectionKey=contract` | This tenant, all statuses, newest first. `sectionKey` optional. Items are `FilterListItem` + `status`. |
| DELETE | `/master-filters/suggestions/:userFilterId` | Withdraw pending. Submitter or client `owner`. `404` / `409` `This suggestion was already reviewed.` |

Upload PUT rules are identical to admin (no auth headers, exact `upload.headers`).

---

## 8. Suggested frontend types

```ts
type SectionKey =
  | "contract" | "genotype" | "ip_right" | "quarantine" | "supply_chain"
  | "timeline" | "todo" | "protocol" | "observation" | "phase" | "project_overview";

type UploadedBy =
  | { kind: "admin"; displayName: string; isCurrentUser: boolean; clientId: null; clientName: null }
  | { kind: "client"; displayName: string; isCurrentUser: boolean; clientId: string; clientName: string };

type FilterListItem = {
  id: string;
  sectionKey: SectionKey;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  uploadedBy: UploadedBy;
};

type MasterFilter = FilterListItem & {
  content: string;
  version: number;
  sourceUserFilterId: string | null;
};

type UserFilter = FilterListItem & {
  content: string;
  status: "PENDING" | "ACCEPTED" | "DISMISSED";
  promotedMasterFilterId: string | null;
};
```
