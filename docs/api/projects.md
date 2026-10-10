POST /api/projects
-------------------------------
Request:
  Auth: required (Clerk Bearer)
  Headers:
    X-Tenant-Slug: string              // recommended; defaults to "dev" on localhost
  Body (application/json):
    {
      "name": string,                  // required, trimmed; empty string rejected
      "primarySpeciesCommon": string,  // optional
      "primarySpeciesBotanical": string // optional
    }

Response 201:
  {
    "success": true,
    "message": "Project created",
    "project": {
      "id": string,
      "tenantId": string,
      "name": string,
      "status": "DRAFT",
      "speciesId": null,
      "primarySpeciesBotanical": string | null,
      "primarySpeciesCommon": string | null,
      "createdById": string,
      "createdAt": string,
      "updatedAt": string
    }
  }

Errors:
  400 { "success": false, "message": "Project name is required." }
  401 { "success": false, "message": "Unauthorized" }   // or Clerk 401
  403 { "success": false, "message": "You are not a member of this organisation." }
  500 { "success": false, "message": "Failed to resolve tenant" }

Notes:
  - Creates a DRAFT project in the tenant identified by X-Tenant-Slug.
  - The current user is automatically added as tenant member and as an ACTIVE VARIETY_MANAGER on the project. They can upload immediately; no extra invite step.
  - 403 only if the tenant already has other members and the current user is not one of them. First user on an empty (e.g. "dev") tenant is allowed through.
  - Do not POST files here. Create the project first, then use document init-upload.


GET /api/projects
-------------------------------
Request:
  Auth: required
  Headers:
    X-Tenant-Slug: string              // recommended

Response 200:
  {
    "success": true,
    "count": number,
    "projects": [
      {
        "id": string,
        "tenantId": string,
        "name": string,
        "status": "DRAFT" | "ACTIVE" | "ARCHIVED",
        "speciesId": string | null,
        "primarySpeciesBotanical": string | null,
        "primarySpeciesCommon": string | null,
        "createdById": string,
        "createdAt": string,
        "updatedAt": string,
        "_count": { "documents": number }
      }
    ]
  }

Errors:
  401 { "success": false, "message": "Unauthorized" }
  500 { "success": false, "message": "Failed to resolve tenant" }

Notes:
  - Returns projects in the current tenant that the user created OR belongs to as a project member.
  - Sorted by updatedAt descending.
  - Tenant membership is not required to hit this route; an empty array is returned if the user has no projects in that tenant.


GET /api/projects/:projectId
-------------------------------
Request:
  Auth: required
  Headers:
    X-Tenant-Slug: string
  Params:
    projectId: string                  // uuid

Response 200:
  {
    "success": true,
    "project": {
      "id": string,
      "tenantId": string,
      "name": string,
      "status": "DRAFT" | "ACTIVE" | "ARCHIVED",
      "speciesId": string | null,
      "primarySpeciesBotanical": string | null,
      "primarySpeciesCommon": string | null,
      "createdById": string,
      "createdAt": string,
      "updatedAt": string
    },
    "documentsByStatus": {
      "PENDING_UPLOAD": number,        // keys only present for statuses that have rows
      "PROCESSING": number,
      "READY": number,
      "FAILED": number
    },
    "phases": [
      {
        "id": string,
        "name": string | null,
        "type": "TRIAL" | "PILOT" | "LAUNCH" | "SCALE" | "CUSTOM" | null,
        "category": "EXPERIMENTAL" | "COMMERCIAL" | null,
        "location": string | null,     // original site prose (cities, regions)
        "countries": string[],         // ISO 3166-1 alpha-2, e.g. ["ES","PT"]; [] if unknown
        "sortOrder": number
      }
    ]
  }

Errors:
  401 { "success": false, "message": "Unauthorized" }
  403 { "success": false, "message": "You are not a member of this organisation." }
  403 { "success": false, "message": "You do not have access to this project." }
  404 { "success": false, "message": "Project not found." }
  500 { "success": false, "message": "Failed to load project" }

Notes:
  - Project lookup is scoped to the current tenant. A valid id from another tenant returns 404, not 403.
  - Viewer access: creator OR ACTIVE project member.
  - documentsByStatus is an object, not an array. Missing keys mean count 0 — treat absent as 0 in the UI.
  - Use this after uploads to show how many files are still processing vs ready.
  - `phases` is the confirmed domain snapshot (empty `[]` until the VM confirms the Phase section).
    Use this for the project-detail world map — not the extraction draft.
  - World map:
      * One marker per distinct country code across phases (not per city).
      * `category` EXPERIMENTAL (TRIAL/PILOT) → Testing marker.
      * `category` COMMERCIAL (LAUNCH/SCALE) → Commercialization marker.
      * Same country on both categories: show both (or a combined popover listing each phase).
      * Skip a phase when `countries` is empty — do not guess from `location` or party country.
      * Popover copy: `name` (title) + `type` (subtitle). Keep `location` as extra detail.
      * `project.status` stays DRAFT after confirm; that does not block this map.
