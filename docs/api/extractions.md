POST /api/projects/:projectId/extractions
-------------------------------
Starts a **v2** chained run: triaged documents × enabled sections in reading order, then `DERIVE_SECTIONS`.

Response 202 `extraction` includes `scope`, `stepsTotal`, `stepsDone`, `currentDocumentId`, `currentSectionKey`, and `steps[]` (per `ExtractionStep`: `documentId`, `sectionKey`, `partIndex`, `status`, `skipReason`, tokens).

Incremental: only documents with `processedAt` null are included until each completes a full run.

POST /api/projects/:projectId/sections/:sectionKey/extract
-------------------------------
Re-extract one section across unprocessed READY documents (`scope: section:<key>`). Same 409 if a run is active.

GET /api/projects/:projectId/extractions/latest
-------------------------------
Poll progress; `steps` list replaces legacy `sections`.

Jobs: `TRIAGE_DOCUMENT` (after text extract), `EXTRACT_STEP` (chain), `DERIVE_SECTIONS` (timeline + overview projection).

See `docs/PROJECT_STRUCTURE.md` for pipeline detail.