Section chatbot APIs — Frontend integration
===========================================

Nubred AI on the review screen. Same auth as other project APIs
(`Authorization`, `X-Tenant-Slug`). Editor only (creator or ACTIVE VARIETY_MANAGER).

Related docs:

  docs/api/_conventions.md
  docs/api/documents.md                 upload PUT + complete + poll READY
  docs/api/frontend-extraction-ui.md    snake_case fieldPath map
  docs/api/review.md                    GET section, PATCH fields, confirm


Intents
-------
  usual              Free question (glossary, this project, uploaded docs)
  source             User asked for citations — return source cards
  resolve_conflict   RESOLVE on a Data Confliction box (API called immediately)
  fill_missing       User sent text and/or chatbot-uploaded files for a missing field
  apply_change       User asked to change a value, or tapped KEEP / CHANGE TO …

Send `intent` explicitly whenever you know it. If omitted, the backend infers
from message / fieldPath / documentIds / value.


Static UI — do NOT call the API
-------------------------------
Missing Information → RESOLVE:

  Open the chat and render locally (no HTTP):

    User:  "Fix the missing part in {label} field"
    AI:    "Sure, please share any document related with the {label} or simply describe on this chat"

  `{label}` = human name of the field (e.g. Species), not the fieldPath.

  After that, if the user types and/or attaches files, THEN call the APIs below
  with intent `fill_missing` and the fieldPath.


POST /api/projects/:projectId/sections/:sectionKey/chat
------------------------------------------------------
Request:
  Auth: required
  Headers:
    X-Tenant-Slug: string
    Content-Type: application/json
  Params:
    projectId, sectionKey    // contract | genotype | phase | protocol | chronology
  Body:
    {
      "message": string,                 // required unless documentIds or value is set
      "intent": "usual" | "source" | "resolve_conflict" | "fill_missing" | "apply_change",
      "fieldPath": string,               // required for resolve_conflict and fill_missing
      "documentIds": string[],           // READY chatbot docs for fill_missing
      "value": any,                      // KEEP / CHANGE button — skip LLM, write this value
      "history": [                       // last turns only; max 12 used
        { "role": "user" | "model" | "assistant", "content": string }
      ]
    }

  fieldPath uses the same paths as fieldMeta / PATCH fields:
    primary_species_common
    phases[0].plant_count
    parties[0].role

Response 200:
  {
    "success": true,
    "intent": "usual" | "source" | "resolve_conflict" | "fill_missing" | "apply_change",
    "reply": {
      "message": string,                 // main bubble text
      "sources": [
        {
          "documentId": string | null,
          "documentName": string,        // filename for the card title
          "quote": string,               // italic snippet
          "page": number | null
        }
      ],
      "options": [                       // conflict buttons; empty otherwise
        {
          "action": "KEEP" | "CHANGE",
          "label": string,               // e.g. "KEEP CHERRY" / "CHANGE TO APPLE"
          "value": any,
          "fieldPath": string
        }
      ],
      "changes": [                       // before/after cards; empty until a write
        {
          "fieldPath": string,
          "fieldLabel": string,          // e.g. "Species"
          "previousValue": any,          // null / missing → show "—"
          "previousDisplay": string,
          "newValue": any,
          "newDisplay": string
        }
      ],
      "found": boolean | null,
      "warning": string | null,          // downstream caution under the bubble
      "applied": boolean                 // true when the draft was written
    },
    "extraction": {                      // refreshed draft after a write; may be the old draft
      "id": string,
      "payload": object,
      "fieldMeta": object,
      "reviewState": object,
      "status": string,
      "updatedAt": string
    } | null,
    "rules": { "blocking": [], "warnings": [], "canConfirm": boolean }  // present after a write
  }

Errors:
  400 unknown sectionKey / intent / missing fieldPath / schema mismatch on apply
  400 {
        "success": false,
        "message": "None of the proposed values fit the target field schema.",
        "issues": [ { "path": string, "message": string } ]
      }
  403 editor-only
  409 no SUCCEEDED draft (resolve / fill / apply)
  409 chatbot document not READY yet
  429 Gemini rate limit — retry
  503 LLM provider unavailable

Notes:
  - Re-bind the review form from `extraction.payload` when `reply.applied` is true.
  - `fieldMeta[path].origin` becomes `"CHATBOT"` for chatbot writes (vs `"VM_MANUAL"`).
  - Chat history is not stored on the server. Keep it in the client; send `history`
    on later turns in the same panel.
  - Do not send file bytes in this JSON (50 KB body limit). Upload first (below).


Per-intent wiring
-----------------

usual
  Body: { "intent": "usual", "message": "What types of projects are available?", "history": [] }
  Render: reply.message only (green bubble).

source
  Body: { "intent": "source", "message": "List down the source of 'Cherry' as species", "fieldPath": "primary_species_common" }
  fieldPath optional but recommended when the question is about one field.
  Render: reply.message + reply.sources[] (filename + italic quote).

resolve_conflict  (Data Confliction → RESOLVE)
  On click, open chat, show the user bubble, and call the API immediately
  (do not wait for send):

    {
      "intent": "resolve_conflict",
      "fieldPath": "phases[0].plant_count",
      "message": "Resolve the confliction in Number of Plantation field"
    }

  Use the human label in `message`; always send snake_case `fieldPath`.

  Render:
    reply.message
    reply.sources[] as stacked citation cards
    reply.options[] as buttons under the bubble

  When the user taps an option, call chat again:

    {
      "intent": "apply_change",
      "fieldPath": option.fieldPath,
      "value": option.value,
      "message": option.label,
      "history": [ prior user + model turns ]
    }

  That returns reply.applied + reply.changes[] (before/after cards) + reply.warning.

fill_missing  (after the static two bubbles)
  1. If the user attaches files: chatbot upload flow (below), poll until READY.
  2. POST chat:

    {
      "intent": "fill_missing",
      "fieldPath": "phases[0].duration",
      "message": "Here’s the file about the species",
      "documentIds": ["uuid-ready-1", "uuid-ready-2"]
    }

  message-only is allowed (user described the value, no file).
  documentIds must be chatbot uploads for THIS sectionKey, status READY.

  If found: reply.applied true, reply.changes[] (old "—" → new value), reply.warning.
  If not: reply.found false, reply.message like "could not find …", no write.

apply_change  (typed “change Italy to Morocco…”)
  Body: { "intent": "apply_change", "message": "Remove italy from the location and change it into morocco and hungary" }
  fieldPath optional if the sentence names the field.
  May return multiple reply.changes[] (e.g. location list + count).
  reply.warning when a later section is not confirmed yet — always show it under the bubble:

    "Your change might affect the next section that has not been reviewed yet"


Chatbot document upload (missing-part files)
--------------------------------------------
Same PUT + complete + poll as project files, but tagged so they do NOT re-run
extraction for every section. They are only used for this section’s chat.

Preferred (forces CHATBOT + section from the URL):

  POST /api/projects/:projectId/sections/:sectionKey/chat/documents/init-upload
  Body: { "files": [ { "filename", "mimeType", "size", "documentType"? } ] }

Equivalent:

  POST /api/projects/:projectId/documents/init-upload
  Body: { "origin": "CHATBOT", "sectionKey": "phase", "files": [ ... ] }

Then identical to docs/api/documents.md:

  1. PUT bytes to upload.url
  2. POST /api/projects/:projectId/documents/:documentId/complete
  3. Poll GET .../documents/:documentId until status READY | FAILED

Serialized document now includes:

  origin: "UPLOAD" | "CHATBOT"
  sectionKey: string | null     // set when origin is CHATBOT

Do not start a new POST /extractions because of these files.
Do not include them in the “initial corpus” mental model — they belong to chat.


Suggested component behaviour
-----------------------------
  Data Confliction box RESOLVE
    → open chat, append user message, POST intent=resolve_conflict, show sources + options

  Missing Information box RESOLVE
    → open chat, append the two static bubbles, wait for user

  Chat + button (usual questions)
    → POST intent=usual or source (use source when they ask “where / source / citation”)

  Option button KEEP / CHANGE TO
    → POST intent=apply_change with fieldPath + value

  After applied
    → replace section form state with extraction.payload; show origin CHATBOT as edited-by-AI


Checklist
---------
  - [ ] Missing RESOLVE is static first; no chat POST until user types or files are READY.
  - [ ] Conflict RESOLVE POSTs immediately with fieldPath + intent resolve_conflict.
  - [ ] Source cards bind documentName + quote (not AgreeLyze clause titles).
  - [ ] KEEP/CHANGE sends apply_change with option.value (do not PATCH unless you prefer review.md).
  - [ ] Chat uploads use the chat init-upload URL (or origin CHATBOT + sectionKey).
  - [ ] Poll READY before fill_missing documentIds.
  - [ ] Show reply.warning when present.
  - [ ] Refresh payload from extraction when reply.applied.
