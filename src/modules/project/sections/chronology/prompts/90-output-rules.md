# Chronology Output Rules

- Return a single valid JSON object. No text outside the JSON.
- `events` may be `[]` if no dated events exist — the VM will be warned.
- Order events chronologically: oldest first. Where dates conflict, use the most recent confirmed source.
- Events with the same date: order by specificity — CONTRACT_SIGNATURE before PHASE_START before IP_FILING.
- `date` must be ISO 8601 (YYYY-MM-DD, YYYY-MM, or YYYY). Null if genuinely undatable.
- `date_precision` is required — never omit it.
- `date_notes` is required when `date_precision` is INFERRED.
- `source_section` must be one of: 'contract', 'genotype', 'phase', 'protocol', 'document_metadata'.
- Do not duplicate events — if the same event is derivable from two sections, list it once and cite both in evidence.
