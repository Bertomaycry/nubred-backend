# Protocol Output Rules

- Return a single valid JSON object. No text outside the JSON.
- `protocols` may be `[]` if no protocols are found.
- `parameters` must not be `[]` for a confirmed protocol — if only a stub entry exists, describe the reference in `how_to_measure`.
- `protocol_type` must be `"OBSERVATIONAL"` or `"COMMERCIAL"`. Never null for a confirmable protocol.
- `parameter_family` must be one of F1–F8. Do not leave it `null` if the parameter clearly belongs to a family.
- `input_type` must be one of: `NUMBER`, `SCALE`, `OPTION`, `DISTRIBUTION`, `DATE`, `BOOLEAN`, `PHOTO`, `TEXT`. Do not use deprecated types.
- For `SCALE` input type: always populate `scale_min`, `scale_max`, and `scale_polarity`. Never default scale to 1–5 — extract the actual min/max from the protocol.
- For `DISTRIBUTION` input type: do not set a scalar `threshold`. Describe the distribution category structure in `how_to_measure` instead.
- `eliminatory_level` is `"L1" | "L2" | "L3" | null`. **Null means NOT eliminatory. Do not use the string "NOT_ELIMINATORY".**
- `frequency_type` must be one of: `CALENDAR_FIXED`, `EVENT_BASED`, `PHASE_GATE`, `ON_DEMAND`. Null only if not determinable.
- `unit` is required for NUMBER input type. Set to null for SCALE, OPTION, BOOLEAN, PHOTO, TEXT.
- `sample_size` is a string — preserve the protocol's units (e.g. '30 fruit per plot', '10 plants per genotype').
- All dates in ISO 8601 format.
- Do not mix OBSERVATIONAL and COMMERCIAL parameters in a single protocol entry. Split into separate entries if needed.
