Return a single JSON object with a `records` array.

Each record must include:
- `ref` (uuid or null)
- `group_path` (string)
- `parent_record_ref` (uuid or null, optional)
- `fields` (object keyed by field key)

Each field value object must include `value`, `status`, and should include `quote` + `page` when status is `found`.

Prefer updating existing records when the document clearly refers to the same entity. Create a new record only when no identity match exists.

Do not wrap the JSON in markdown fences.