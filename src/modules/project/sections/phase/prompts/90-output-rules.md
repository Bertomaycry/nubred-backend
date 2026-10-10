# Phase Output Rules

- Return a single valid JSON object. No text outside the JSON.
- Order phases chronologically (earliest first).
- `phases` may be `[]` if no phases are found — the VM will add them manually.
- `plant_count` must be an integer or `null`. `hectares` must be a number or `null`.
- `gate_criteria` may be `[]` if no criteria are stated — NuBred standard criteria apply by default.
- `countries` is an array of ISO 3166-1 alpha-2 codes (uppercase, e.g. `["ES","PT"]`). Split multi-country locations. Use `[]` if no country is stated. Do not put codes in `location`.
- `genotype_decisions` may be `[]` if no decisions are documented.
- All dates in ISO 8601 format (YYYY-MM-DD or YYYY).
- Do not invent phase names or durations. Extract only what is stated in the documents.
