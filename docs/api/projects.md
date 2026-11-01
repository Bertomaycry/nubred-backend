POST /api/projects
-------------------------------
Request:
  Auth: required (Clerk Bearer)
  Headers:
    X-Tenant-Slug: string              // only if the user belongs to several clients
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
  400 { "message": "Select a workspace." }               // several clients, no X-Tenant-Slug
  403 { "success": false, "message": "You do not have access to this workspace." }
  403 { "success": false, "message": "This workspace has been restricted." }
  403 { "success": false, "message": "Your role cannot create projects." }   // field_observer, viewer
  409 { "success": false, "message": "Your organisation has reached its limit of N projects." }

Notes:
  - Creates a DRAFT project in the caller's client database. Client roles owner, master_project_manager and project_manager may create.
  - The current user is automatically an ACTIVE VARIETY_MANAGER on the project. They can upload immediately; no extra invite step.
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
        "name": string,
        "status": "DRAFT" | "ACTIVE" | "ARCHIVED",
        "myRole": ProjectRole | null,
        "isFieldObserver": boolean,
        "myState": "ACTIVE" | "PENDING",
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
  403 { "success": false, "message": "You do not have access to this workspace." }

Notes:
  - Returns projects in the caller's client database that the user created, belongs to, or has a PENDING invitation to (myState).
  - Sorted by updatedAt descending.


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
      "name": string,
      "status": "DRAFT" | "ACTIVE" | "ARCHIVED",
      "speciesId": string | null,
      "primarySpeciesBotanical": string | null,
      "primarySpeciesCommon": string | null,
      "createdById": string,
      "createdAt": string,
      "updatedAt": string,
      "myRole": ProjectRole,           // creator is VARIETY_MANAGER
      "isFieldObserver": boolean,
      "sectionAccess": { overview, genotype, supply_chain, phases, contracts, ip_rights, todo: "full" | "read" | "hidden" }
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
  - Project lookup runs in the caller's client database. A valid id from another client returns 404, not 403.
  - Access: creator OR ACTIVE project member (PENDING invitees only accept via POST /members/accept).
  - Members (VARIETY_MANAGER only): GET/POST /api/projects/:projectId/members, PATCH/DELETE .../members/:memberId. Invitee: POST .../members/accept. The invitee must already be a client user.
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
