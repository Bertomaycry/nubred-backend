GET /api/projects/:projectId/sections
-------------------------------
Enabled sections with `SectionState.status`, chip counts, `upstreamChangedAt`.

GET /api/projects/:projectId/sections/:sectionKey/definition
-------------------------------
Field tree for the section (from `*.fields.js`).

GET /api/projects/:projectId/sections/:sectionKey
-------------------------------
Field store: records, field badges (VALID / PROVISIONAL / CONFLICT / MISSING / READ_ONLY), candidates, sources, `chipCounts`, confirm rules.

PATCH /api/projects/:projectId/sections/:sectionKey/fields
-------------------------------
Body: `{ "action": "accept"|"edit"|"gap"|"choose"|"undo", "recordId", "fieldKey", "value?", "candidateId?", "reason?" }`

POST /api/projects/:projectId/sections/:sectionKey/confirm
-------------------------------
Blocked when rules fail (conflicts / required missing without gap).

User filter: `GET|PUT|DELETE .../sections/:sectionKey/filter`, upload via `.../filter/init-upload` + `.../filter/:filterId/complete` (`reextract` flag on PUT/complete).