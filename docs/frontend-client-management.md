# Client management — frontend integration

Source of truth for wiring the admin Client screens and the tenant workspace behaviour those screens depend on. Paths are relative to the API origin (`http://localhost:8080` locally). Every JSON error from these routes is:

```json
{ "success": false, "message": "Human readable text" }
```

Toast `message`. Clerk's own 401 (no / expired session) may not use this shape.

Do not send a tenant id, database name, or bucket name. The server derives those from the slug.

---

## 1. Who calls what

| App | Host | Auth |
|---|---|---|
| Admin (Add / Edit / list / detail / restrict) | `https://gov.nubred.com` | Clerk user whose `GET /api/auth/me` → `user.role` is `"admin"` |
| Tenant workspace | `https://{slug}.gov.nubred.com` | Clerk user who was added to that client. Platform `user.role` is `"user"`. |

`user.role` from `/api/auth/me` is only `"user"` or `"admin"`. It is **not** the client role (`owner`, `project_manager`, …). Admin routes reject anyone who is not `"admin"` with `403` `"Not authorized as an admin"`.

A NuBred admin cannot also be a client user. Do not offer admin emails in the Add/Edit user list.

### Headers

```
Authorization: Bearer <Clerk session JWT>
Content-Type: application/json
```

`X-Tenant-Slug` is **not** sent on `/api/admin/clients`. It is only for tenant-workspace calls (section 8).

CORS allows `http://localhost:5173`, `https://gov.nubred.com`, `https://gov.preview.nubred.com`, `https://governance.nubred.com`, `https://preview.nubred.com`, `https://node.nubred.com` (and the `www.` variants of those). It also allows a client workspace `https://{slug}.gov.nubred.com` and `https://{slug}.gov.preview.nubred.com` when `{slug}` is a valid client slug. Allowed request headers include `Authorization`, `Content-Type`, `X-Tenant-Slug`.

---

## 2. Shared body (create and update)

```json
{
  "companyName": "Agri Levante SRL",
  "maxProjects": 5,
  "uniqueUrl": "agri-levante",
  "users": [
    { "email": "owner@agrilevante.com", "role": "owner" },
    { "email": "pm@agrilevante.com", "role": "project_manager" }
  ],
  "modules": {
    "contract": true,
    "genotype": false,
    "phase": true,
    "protocol": false,
    "field_observation": false,
    "timeline": false,
    "model_supply_chain": false,
    "todo": false,
    "ip_right": false,
    "quarantine": false,
    "predictive_genotype_analysis": true,
    "ai_protocol_generation": false,
    "contract_risk_analysis": false
  }
}
```

`maxProjects` may be a JSON number or a numeric string (`"5"`). The server stores a number.

`uniqueUrl` is the slug only, never the full host. The server lowercases it. The workspace URL the UI shows and copies is:

```
https://{uniqueUrl}.gov.nubred.com
```

### Validation (server enforces these; first failing rule is `message`)

| Field | Rule | `message` |
|---|---|---|
| `companyName` | Required after trim, max 200 | `Company name is required.` / `Company name is too long.` |
| `maxProjects` | Integer ≥ 1 | `Maximum projects is required.` / `Maximum projects must be a whole number of at least 1.` |
| `uniqueUrl` (create) | See slug rules below | See below |
| `users` | At least one. Emails unique after lowercasing. Exactly one `owner`. Role required | `At least one user is required.` / `Enter a valid email address.` / `{email} is listed more than once.` / `Exactly one owner is required.` / `Each user needs a valid role.` |
| `modules` | All 13 ids present as booleans. Unknown id rejected. All `false` is valid | `Module "{id}" is missing.` / `Unknown module "{id}".` / `Each module must be true or false.` |

Slug, after lowercasing:

- Pattern: `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`
- Max 48 characters
- No leading or trailing hyphen
- Reserved (rejected): `www`, `api`, `admin`, `app`, `mail`, `minio`, `dev`, `staging`, `static`, `assets`

Slug messages: `Unique URL is required.` / `Unique URL must be at most 48 characters.` / `Unique URL may only use lowercase letters, numbers and hyphens, and cannot start or end with a hyphen.` / `This unique URL is reserved.`

### Client roles (the only values `users[].role` accepts)

Order used on the detail card (owner first, then this order, then email):

1. `owner`
2. `master_project_manager`
3. `project_manager`
4. `field_observer`
5. `viewer`

These are client roles. They are not project roles (section 9).

### Module ids (send all 13, in this order)

Governance: `contract`, `genotype`, `phase`, `protocol`, `field_observation`, `timeline`, `model_supply_chain`, `todo`, `ip_right`, `quarantine`

AI (the only ones that can write token credits): `predictive_genotype_analysis`, `ai_protocol_generation`, `contract_risk_analysis`

Detail `moduleIds` is the enabled subset, in the order above. Edit must send the full boolean map, not that subset.

---

## 3. List

`GET /api/admin/clients?page=1&limit=6&search=&status=`

| Query | Behaviour |
|---|---|
| `page` | Default 1 |
| `limit` | Default 6, max 50 |
| `search` | Optional. Case-insensitive match on company name **or owner email** |
| `status` | Omit, or `active`, or `inactive`. Anything else is `400` `status must be active or inactive.` |

Only clients that finished provisioning are returned. A failed create never appears.

`200`

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Agri Levante SRL",
      "email": "owner@agrilevante.com",
      "status": "active",
      "usersCount": 4,
      "modulesCount": 3
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 6,
    "total": 20,
    "totalPages": 4,
    "from": 1,
    "to": 6
  }
}
```

`email` is the owner's email. `usersCount` is current users. `modulesCount` is how many flags are on. `status` is `active` or `inactive` only. Newest first.

Empty list: `data: []`, `total: 0`, `totalPages: 0`, `from: 0`, `to: 0`.

---

## 4. Create

On step 1 Next, before opening Module Configuration:

`GET /api/admin/clients/slug-available?uniqueUrl={slug}`

Admin auth. No `X-Tenant-Slug`. `uniqueUrl` is the slug only (`agri-levante`), lowercased by the server.

`200` `{ "success": true }` — go to step 2. Do not toast.

`409` `{ "success": false, "message": "This unique URL is already in use." }` — stay on step 1 and toast `message`. Same text as a failed create.

`400` — toast `message` (`Unique URL is required.`, format, or `This unique URL is reserved.`).

`POST /api/admin/clients`

Body: section 2. This provisions a database and a bucket. It can take longer than a normal save. Do not retry on a slow response; a retry with the same slug, after success, is `409`.

`201`

```json
{
  "success": true,
  "message": "Agri Levante SRL has been added.",
  "data": { "id": "uuid" }
}
```

Toast `message`. `data.id` is the detail-page id. Today the UI can still go back to the list.

If an invitation email could not be sent, the client **is** created and the response also has:

```json
"inviteFailures": [{ "email": "pm@agrilevante.com", "reason": "..." }]
```

The field is absent when every invite email was sent. Nobody is a member until they accept. A failed email is not in `pendingInvites`.

| Status | `message` |
|---|---|
| 400 | Validation text from section 2, or `{email} is a NuBred admin and cannot be added as a client user.` |
| 409 | `This unique URL is already in use.` |
| 500 | `Could not set up this client. Try again.` The client is not listed. The same slug can be submitted again. |

---

## 5. Detail

`GET /api/admin/clients/:id`

`200`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Agri Levante SRL",
    "email": "owner@agrilevante.com",
    "status": "active",
    "usersCount": 2,
    "modulesCount": 3,
    "maxProjects": 5,
    "uniqueUrl": "agri-levante",
    "createdAt": "2026-08-25T09:00:00.000Z",
    "moduleIds": ["contract", "phase", "predictive_genotype_analysis"],
    "users": [
      {
        "id": "uuid",
        "email": "owner@agrilevante.com",
        "role": "owner",
        "timeUsage": { "all_time": 120, "this_month": 18, "this_week": 6, "today": 1.5 },
        "tokenUsage": { "all_time": 840, "this_month": 120, "this_week": 40, "today": 0 }
      }
    ],
    "pendingInvites": [
      {
        "email": "pm@agrilevante.com",
        "role": "project_manager",
        "expiresAt": "2026-11-13T09:00:00.000Z"
      }
    ]
  }
}
```

- `uniqueUrl` is the slug. Build the copyable host as `https://{uniqueUrl}.gov.nubred.com`.
- `timeUsage` values are **hours** (number, one decimal). `0` stays `0`.
- `tokenUsage` values are **integer credits**, not raw tokens.
- All four periods are always present, including zeros. The bar skips zeros. The UI sums the bar; the API does not return percentages.
- Period keys: `today`, `this_week`, `this_month`, `all_time`. Windows are UTC (today from 00:00Z, week from Monday 00:00Z, month from the 1st 00:00Z).
- `users` are people who have joined. `usersCount` is that list only. The usage chart uses `users`.
- `pendingInvites` are emails that have not accepted. `expiresAt` is ISO. They have no usage.
- `email` is the owner. It is set when the owner is still pending, and `usersCount` can be `0`.
- Build the edit form from `users` plus `pendingInvites`, and submit that combined list as `users`. Leaving a pending email out revokes it.
- One request is enough for every period. Do not refetch when the period menu changes.
- Unknown id, or a client that never finished provisioning: `404` `Client not found`.

Menu: `status === "active"` → Restrict. `status === "inactive"` → Reactivate. There is no third status.

---

## 6. Update

`PUT /api/admin/clients/:id` (not PATCH)

Same body as create. This does **not** provision again and does **not** change the slug, database, or bucket. Renaming the company does not rename the URL.

`uniqueUrl`: send the stored slug (the form keeps the field). If it differs from the stored slug, even by case after lowercasing: `400` `The custom URL cannot be edited.` Omitting it is allowed.

`users` is the full desired set, including people who have not accepted:

- Email not in the list → a member loses access, or a pending invite is revoked. Past usage stays in the database. They disappear from `users`.
- New email → a pending invite is sent. They are not a member yet. `inviteFailures` may be present.
- Same pending email → no second email. A role change is saved on the invite.
- Same member email, new role → the membership role is updated.
- The payload must still contain exactly one owner.

`modules` replaces every flag. Turning one off does not delete data or past usage. It blocks new use (section 8).

`200`

```json
{ "success": true, "message": "Agri Levante SRL has been updated." }
```

`message` uses the **submitted** company name. `inviteFailures` is included only when a new user's invite email failed.

`404` `Client not found` is returned before validation when the id is unknown.

---

## 7. Restrict and reactivate

Restrict takes effect on the next request from that client's users. Nothing is deleted.

`POST /api/admin/clients/:id/restrict`

```json
{ "reason": "security_violation" }
```

`reason` is required. `"security_violation"` or `"client_stop_paying"`. The UI may default the radio; the request must still send it. Missing or other value: `400` `reason must be one of: security_violation, client_stop_paying.`

`200` `{ "success": true, "message": "Agri Levante SRL has been restricted." }`

Already inactive: `409` `This client is already restricted.`

`POST /api/admin/clients/:id/reactivate`

No body.

`200` `{ "success": true, "message": "Agri Levante SRL has been reactivated." }`

Already active: `409` `This client is already active.`

---

## 8. Tenant workspace (not the admin UI)

The tenant app calls the existing `/api/projects` APIs. Client management adds the rules below. Full project/document/extraction shapes stay in `docs/api/`.

### Selecting the client

Header on every tenant call, including the heartbeat:

```
X-Tenant-Slug: agri-levante
```

The header only **selects**. Access still requires that this login was added to that client (by the admin user list). The slug in the header cannot grant access to a client the user is not on.

| Situation | Result |
|---|---|
| User belongs to this slug | Request proceeds |
| User has exactly one client and the header is omitted | That client is used |
| User has several clients and the header is omitted | `400` `Select a workspace.` |
| Slug is not one of their clients | `403` `You do not have access to this workspace.` |
| Client is restricted (`inactive`) | `403` `This workspace has been restricted.` |
| Client is not ready | `403` `This workspace is not available.` |

Production: read the slug from the subdomain (`agri-levante` from `agri-levante.gov.nubred.com`) and always send it. There is **no** API that lists "my workspaces".

Local: send the slug of the client you created. If that user belongs to only one client, the header may be omitted.

On first login after an invite, the server links the Clerk account to the client by email. The frontend does nothing besides sending the normal Bearer token.

### Heartbeat (Time Usage card)

The admin UI does not call this. The tenant app does.

`POST /api/usage/heartbeat`

Empty body. Ignore any user id or seconds you might have put in a body; the server ignores the body. Identify the user from the Bearer token and the client from `X-Tenant-Slug`.

Send every **30 seconds** only while `document.visibilityState === "visible"` and the last mouse, keyboard, or scroll input was within **60 seconds**. On hide, `pagehide`, or logout you may send one last beat. Do not depend on it arriving.

`204` with no body. Do not parse JSON.

Each accepted beat adds 30 seconds, or only the elapsed seconds if the previous accepted beat was under 30 seconds ago. The client cannot inflate the chart by replaying faster.

Rejected the same way as any other tenant call (no membership, restricted, several clients and no slug). Admins with no client membership get `403`. They do not generate client time usage.

### Module flags in the tenant app

Hiding a menu is not enough; the API also rejects a disabled module with:

`403` `This module is not enabled for your organisation.`

Section key → module id:

| Section route key | Module id |
|---|---|
| `contract` | `contract` |
| `genotype` | `genotype` |
| `phase` | `phase` |
| `protocol` | `protocol` |
| `chronology` | `timeline` |

Starting extraction when none of `contract`, `genotype`, `phase`, `protocol` are on:

`400` `No extraction modules (contract, genotype, phase, protocol) are enabled for this client.`

**Gap:** there is no tenant endpoint that returns the enabled module ids or the caller's client role. The admin detail payload is admin-only. Until a workspace endpoint exists, the tenant app cannot read flags except by getting this 403. Do not call `/api/admin/clients/:id` from the tenant app.

### Who may create a project

Client role → `POST /api/projects`:

| Client role | Create project |
|---|---|
| `owner`, `master_project_manager`, `project_manager` | Allowed. They become Variety Manager of that project |
| `field_observer`, `viewer` | `403` `Your role cannot create projects.` |

Over the client's `maxProjects`: `409` `Your organisation has reached its limit of {n} projects.`

`POST /api/projects` body is unchanged: `{ "name", "primarySpeciesCommon?", "primarySpeciesBotanical?" }`.

---

## 9. Project members (tenant app, Variety Manager)

A person must already be on the client's user list before they can be invited to a project. The admin Add/Edit screen is that list. The project invite screen is not.

| Method | Path | Who |
|---|---|---|
| `GET` | `/api/projects/:projectId/members` | Variety Manager |
| `POST` | `/api/projects/:projectId/members` | Variety Manager |
| `PATCH` | `/api/projects/:projectId/members/:memberId` | Variety Manager |
| `DELETE` | `/api/projects/:projectId/members/:memberId` | Variety Manager |
| `POST` | `/api/projects/:projectId/members/accept` | The invited user (their row is still `PENDING`) |

Invite body:

```json
{ "email": "pm@agrilevante.com", "role": "GROWER", "isFieldObserver": false }
```

`role` is a **project** role, not a client role: `VARIETY_MANAGER`, `NURSERY`, `GROWER`, `PACKHOUSE_MARKETER`, `FIELD_OBSERVER`.

`201` `{ "success": true, "message": "Invitation created.", "emailSent": true, "member": { ... } }`

`emailSent: false` means the row exists but the email did not go out. Show that; do not retry the POST (the second call is `409`).

| Status | `message` |
|---|---|
| 400 | `Ask your NuBred admin to add this user to the client first.` |
| 400 | `A valid email is required.` / `role must be one of: VARIETY_MANAGER, NURSERY, GROWER, PACKHOUSE_MARKETER, FIELD_OBSERVER.` |
| 409 | `This person is already invited.` |

Member object:

```json
{
  "id": "uuid",
  "email": "pm@agrilevante.com",
  "userId": null,
  "role": "GROWER",
  "isFieldObserver": false,
  "state": "PENDING",
  "invitedAt": "2026-10-29T12:00:00.000Z",
  "acceptedAt": null
}
```

`state` becomes `ACTIVE` only after `POST .../members/accept`. Until then the invitee sees the project in `GET /api/projects` with `myState: "PENDING"` and cannot open it (`403` `You do not have access to this project.`). Accept response: `{ "success": true, "message": "Invitation accepted.", "member": { ... } }`.

`PATCH` body is `{ "role"?, "isFieldObserver"? }` (at least one). `DELETE` removes the row. Removing or demoting the last active Variety Manager: `409` `A project needs at least one Variety Manager.` The project creator keeps Variety Manager access even without a member row.

`GET /api/projects/:projectId` adds `myRole`, `isFieldObserver`, and `sectionAccess` for the seven tabs (`overview`, `genotype`, `supply_chain`, `phases`, `contracts`, `ip_rights`, `todo`). Each value is `full`, `read`, or `hidden`. Grey out `hidden`. `read` is GET only. Documents, extraction, chat, edits, and member management stay Variety Manager only, even when a tab is `full`.

`GET /api/projects` list items add `myRole`, `isFieldObserver`, `myState` (`ACTIVE` or `PENDING`).

---

## 10. Do not

- Do not send `X-Tenant-Slug` to admin client routes.
- Do not treat `/api/auth/me` `user.role` as a client role.
- Do not PUT a changed `uniqueUrl`.
- Do not send `moduleIds` back on edit. Send the full `modules` boolean map.
- Do not omit the owner on edit.
- Do not drop a user from the chart by forgetting them in the usage math. The API already returns zeros. Sum only the `users` array.
- Do not call the heartbeat from the admin UI.
- Do not invite a project member who is not already a client user.
