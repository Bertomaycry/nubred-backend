Review & confirm APIs — Frontend integration
============================================

After extraction drafts exist, the Variety Manager reviews each section, edits
fields, then confirms. Confirmation is **server-side**: the backend evaluates
`*.rules.js` and only then copies the draft into domain tables.

Chatbot auto-fill is in `docs/api/chat.md`. Manual edits still go through PATCH fields (`VM_MANUAL`). Chat writes use origin `CHATBOT`.

Related docs:

  docs/api/_conventions.md              auth, headers, error envelope
  docs/api/extractions.md               poll until section SUCCEEDED
  docs/api/frontend-extraction-ui.md    snake_case payload field map


sectionKey (path param)
-----------------------
  contract | genotype | phase | protocol | chronology

Unknown keys return 400.


Who can call what
-----------------
  GET section:     project viewer (creator or ACTIVE member)
  PATCH / POST:    project editor (creator or ACTIVE VARIETY_MANAGER)


Suggested frontend flow
-----------------------
  1. Poll GET /extractions/latest?includePayload=true until the section is SUCCEEDED.
  2. Switch to GET /api/projects/:projectId/sections/:sectionKey for that section
     (payload + fieldMeta + evidence + live rules + confirmation + override history).
  3. Bind the form from extraction.payload (same snake_case map as frontend-extraction-ui.md).
  4. On every edit (including resolving a CONFLICTING / UNKNOWN value):
       PATCH .../sections/:sectionKey/fields
         { "fieldPath": "parties[0].role", "value": "LICENSEE", "reason": "optional" }
  5. Contract only: when the user opens the Gaps tab:
       PATCH .../sections/:sectionKey/review-state
         { "gapsTabViewed": true }
     Confirm is blocked until this is true.
  6. Enable Confirm when rules.canConfirm === true.
     Warnings do not block — show them, optionally pass their ids as warningsAck.
  7. POST .../sections/:sectionKey/confirm
  8. Re-confirm is allowed (updates snapshot and re-promotes domain rows).
  9. Do not start a new extraction while reviewing: review APIs use the **latest**
     ExtractionRun. If that run is still QUEUED/RUNNING, PATCH/confirm return 409.

Project status stays DRAFT. Activation is a later step.


GET /api/projects/:projectId/sections/:sectionKey
------------------------------------------------
Request:
  Auth: required
  Headers:
    X-Tenant-Slug: string
  Params:
    projectId: string
    sectionKey: string

Response 200:
  {
    "success": true,
    "sectionKey": "contract",
    "label": "Contracts",
    "kind": "extractor" | "deriver",
    "order": 1,
    "reviewTabs": [
      { "id": "actors", "label": "Actors", "order": 1 },
      { "id": "clause_analysis", "label": "Clause Analysis", "order": 2 },
      { "id": "gaps", "label": "Gaps", "order": 3, "mustViewBeforeConfirm": true }
    ],
    "extraction": {
      "id": string,
      "extractionRunId": string,
      "status": "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED",
      "error": string | null,
      "payload": object | null,
      "fieldMeta": {
        "<fieldPath>": {
          "confidence": "CONFIRMED" | "PROVISIONAL" | "MISSING" | "CONFLICTING",
          "sources": string[],
          "origin": "VM_MANUAL"   // present only after a VM edit
        }
      } | null,
      "reviewState": { "gapsTabViewed": true } | {},
      "createdAt": string,
      "updatedAt": string,
      "evidence": [
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
    },
    "rules": {
      "blocking": [ { "id": string, "message": string, "type": "blocking" } ],
      "warnings": [ { "id": string, "message": string, "type": "warning" } ],
      "canConfirm": boolean
    },
    "confirmation": {
      "sectionKey": string,
      "confirmedAt": string,
      "confirmedById": string,
      "reviewState": object | null,
      "warningsAck": string[] | null
    } | null,
    "overrides": [
      {
        "id": string,
        "fieldPath": string,
        "previousValue": any,
        "newValue": any,
        "source": "VM_MANUAL",
        "reason": string | null,
        "overriddenById": string,
        "createdAt": string
      }
    ]
  }

Errors:
  400 unknown sectionKey
  401 unauthorized
  403 viewer-only
  404 { "success": false, "message": "No extraction found for section \"contract\". Start an extraction first." }

Notes:
  - Always use this endpoint for the review screen after the section is SUCCEEDED.
  - rules.canConfirm is the only source of truth for enabling the Confirm button.
    Do not re-implement blocking rules in the client.
  - fieldMeta[path].origin === "VM_MANUAL" → show an “edited by VM” badge.
    Why? still uses evidence[] (sources are kept on edit).
  - Manual edits set confidence to PROVISIONAL (value present) or MISSING (null).
    They are never auto-marked CONFIRMED.
  - Resolve a CONFLICTING field the same way as any other edit: PATCH the chosen
    value. That clears CONFLICTING for that path.
  - overrides is newest-first (max 200). Use it for an edit history, not for binding.
  - confirmation is null until the first successful confirm.


PATCH /api/projects/:projectId/sections/:sectionKey/fields
---------------------------------------------------------
Request:
  Auth: required
  Headers:
    X-Tenant-Slug: string
    Content-Type: application/json
  Params:
    projectId, sectionKey
  Body:
    {
      "fieldPath": string,     // required. Same paths as fieldMeta / evidence.
      "value": any,            // required. JSON-null clears the field.
      "reason": string         // optional. Same for a normal edit or a conflict resolve.
    }

  fieldPath examples:
    contract_type
    parties[0].role
    parties[0].name
    financial_terms.entry_fee
    genotypes[1].species_botanical
    phases[0].type
    protocols[0].linked_phase
    events[0].date

  To replace a whole array (e.g. add a party), PATCH the array field:
    { "fieldPath": "parties", "value": [ /* full parties array */ ] }

  Forbidden: fieldPath starting with "evidence" (Why? citations are read-only).

Response 200:
  {
    "success": true,
    "message": "Field updated.",
    "extraction": {
      "id": string,
      "extractionRunId": string,
      "sectionKey": string,
      "status": "SUCCEEDED",
      "payload": object,
      "fieldMeta": object,
      "reviewState": object,
      "updatedAt": string
    },
    "rules": {
      "blocking": [],
      "warnings": [],
      "canConfirm": boolean
    }
  }

Errors:
  400 { "success": false, "message": "fieldPath is required." }
  400 { "success": false, "message": "value is required (use null to clear a field)." }
  400 { "success": false, "message": "The evidence array cannot be edited. Use Why? citations from GET." }
  400 {
        "success": false,
        "message": "Updated value failed section schema validation.",
        "issues": [ { "path": "parties[0].role", "message": "..." } ]
      }
  400 unknown / invalid fieldPath
  403 editor-only
  409 { "success": false, "message": "Section \"contract\" has no SUCCEEDED draft to review. Wait for extraction to finish this section first." }

Notes:
  - Re-bind the form from extraction.payload after each PATCH (Zod may coerce).
  - Re-read rules.canConfirm from this response — no extra GET required.
  - reason is stored on FieldOverride; it is not shown as a separate “resolve” API.
    Conflict resolve = this same PATCH.


PATCH /api/projects/:projectId/sections/:sectionKey/review-state
---------------------------------------------------------------
Request:
  Auth: required
  Headers:
    X-Tenant-Slug: string
    Content-Type: application/json
  Params:
    projectId, sectionKey
  Body (merge, booleans only):
    {
      "gapsTabViewed": true
    }

  Allowed keys today: gapsTabViewed
  Unknown keys → 400.

Response 200:
  {
    "success": true,
    "message": "Review state updated.",
    "extraction": { /* same draft object as PATCH fields */ },
    "rules": { "blocking": [], "warnings": [], "canConfirm": boolean }
  }

Errors:
  400 unknown key / non-boolean / empty body
  403 editor-only
  409 no SUCCEEDED draft

Notes:
  - Contract blocking rule `gaps_tab_not_viewed` fires until gapsTabViewed === true.
  - Call this once when the Gaps tab is shown (not on Confirm click).
  - Other sections accept the same body; it is a no-op for their rules if unused.
  - Value false is allowed (clears the flag and will block contract confirm again).


POST /api/projects/:projectId/sections/:sectionKey/confirm
---------------------------------------------------------
Request:
  Auth: required
  Headers:
    X-Tenant-Slug: string
    Content-Type: application/json
  Params:
    projectId, sectionKey
  Body:
    {
      "warningsAck": string[]    // optional. Rule ids from rules.warnings[].id
    }

Response 200:
  {
    "success": true,
    "message": "Section confirmed.",
    "confirmation": {
      "sectionKey": "contract",
      "confirmedAt": string,
      "confirmedById": string,
      "reviewState": object,
      "warningsAck": string[]
    },
    "rules": {
      "blocking": [],
      "warnings": [ /* still listed if they apply; they did not block */ ],
      "canConfirm": true
    }
  }

Errors:
  403 editor-only
  409 no SUCCEEDED draft
  409 {
        "success": false,
        "message": "Section cannot be confirmed until blocking rules are resolved.",
        "blocking": [
          { "id": "gaps_tab_not_viewed", "message": "...", "type": "blocking" },
          { "id": "no_parties", "message": "...", "type": "blocking" }
        ],
        "warnings": [
          { "id": "high_risk_flags", "message": "...", "type": "warning" }
        ]
      }

Notes:
  - If blocking is non-empty, nothing is written. Show blocking[].message and keep the form open.
  - warnings never block. Pass their ids in warningsAck if the UI collected an acknowledgement.
  - Successful confirm:
      * upserts SectionConfirmation (payloadSnapshot locked)
      * promotes into domain tables (see below)
      * does NOT set project.status to ACTIVE
  - Re-POST confirm after further PATCHes to refresh the snapshot and domain rows.
  - Confirm order that preserves links: contract → genotype → phase → protocol → chronology.
    Confirming phase replaces Phase rows (protocol.phaseId is set null, then restored
    when protocol is confirmed). Confirming protocol replaces Protocol rows.


Blocking vs warning (do not re-implement — read GET rules)
----------------------------------------------------------
Contract blocking:
  - parties must be non-empty
  - gapsTabViewed must be true
  - no party with role UNKNOWN
  - no fieldMeta confidence CONFLICTING

Contract warnings (confirm still allowed):
  - any HIGH severity flag
  - confidence_score < 0.7
  - financial_terms.royalty_structure or entry_fee is PROVISIONAL

Genotype blocking: ≥1 genotype; every genotype has species (own or primary_species_*);
  no CONFLICTING.
Genotype warnings: duplicate names; development_status UNKNOWN.

Phase blocking: ≥1 phase; every phase has type; no CONFLICTING.
Phase warnings: CUSTOM type present; a phase with empty gate_criteria.

Protocol blocking: ≥1 protocol; each has parameters; each has linked_phase; no CONFLICTING.
Protocol warnings: no eliminatory_level set on any parameter; Field Observer reminder
  (always present — post-confirm assignment).

Chronology blocking: CONFLICTING only.
Chronology warnings: empty events; all dates INFERRED.


What confirm writes (domain)
----------------------------
  contract   → one ProjectContract per project (upsert) + replace parties + replace
               clauses from payload.flags (clause_id, type, severity, note)
  genotype   → upsert Genotype by name; set project.primarySpeciesBotanical/Common
  phase      → replace Phase rows + PhaseGenotype (matched by genotype name).
               Phase.countries is ISO 3166-1 alpha-2 string[] (invalid codes dropped).
  protocol   → replace Protocol + ProtocolParameter; phaseId linked when a Phase
               with matching type exists
  chronology → replace ChronologyEvent rows

Invalid enum leftovers from the LLM are stored as null (or OTHER / INFERRED for
chronology). They will not 500 the confirm call.


UI checklist
------------
  - [ ] After section SUCCEEDED, load GET /sections/:sectionKey (not only poll payload).
  - [ ] Bind snake_case payload paths. See frontend-extraction-ui.md.
  - [ ] PATCH fields on blur/save; use fieldPath like parties[0].role.
  - [ ] Show origin VM_MANUAL as edited; Why? still from evidence.
  - [ ] Contract: PATCH review-state { gapsTabViewed: true } when Gaps is viewed.
  - [ ] Confirm button disabled unless rules.canConfirm.
  - [ ] On 409 confirm, render blocking[] (and warnings[] as non-blocking).
  - [ ] Chatbot: docs/api/chat.md (conflict RESOLVE posts immediately; missing is static first).
  - [ ] Do not expect project.status ACTIVE after confirm.
