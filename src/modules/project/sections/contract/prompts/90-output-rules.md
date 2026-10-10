# Output Rules

## Format

Return a **single valid JSON object** matching the extraction schema. Do not include any text, markdown, commentary, or explanation outside the JSON. The response must be parseable by `JSON.parse()` without any transformation.

## Null rules

- If a field is not found in the contract → return `null` for that field.
- **Never omit a field key.** A missing key is treated as a schema error; a `null` value is a valid "not found" result.
- If an array field has no items → return `[]` (empty array), not `null`.
- Exception: `minimum_quantities`, `trademark`, `option_rights`, and `edv_clause` are objects that may be `null` as a whole if the concept is entirely absent from the contract.

## Language rules

- Extract field values in English using NuBred Glossary terms.
- Preserve the original document language **only** in the `quote` field of each evidence entry — verbatim, not paraphrased.
- For bilingual contracts (Italian/English, Spanish/English): extract from the English version where available. If only the non-English version contains the relevant passage, translate the value and quote the original.

## Dates

- All dates must be in ISO 8601 format: `YYYY-MM-DD`.
- If only the year is known: `YYYY`.
- If the date is expressed as a trigger (e.g. "end of PBR"), describe it in plain English and return `null` for that field — do not attempt to calculate a date.
- Do not infer dates from context. If a contract is effective "from the date of signature" and no date is stamped, return `null`.

## Confidence score

- `confidence_score` is your confidence in the **contract family classification** (0.0–1.0), not in the extraction quality overall.
- 0.9–1.0: The contract type is unambiguous from the object clause and recitals.
- 0.7–0.89: Probable classification but some elements are mixed.
- 0.5–0.69: Uncertain — the contract has characteristics of more than one family. Explain in a flag.
- Below 0.5: Do not use — reclassify with the best available match and flag the uncertainty.

## Evidence requirements

- Every non-null extracted value must have at least one entry in the `evidence` array.
- For arrays (parties, varieties, rights_granted, etc.): provide evidence for each element using the field path format `parties[0].name`, `varieties[1].pbr_status`, etc.
- For nested objects (financial_terms, territories, etc.): provide evidence for each sub-field that has a non-null value.
- If a value is derived from multiple passages (e.g. financial terms assembled from several clauses), include one evidence entry per passage.
- The `framework_element` field should name the AgreeLyze clause ID (e.g. `'Clause: C-10 Minimum Quantities'`) or the NuBred Glossary term (e.g. `'Glossary: IVM'`) that guided your mapping.

## Flags completeness

- The `flags` array must be complete. Go through C-01 to C-45 systematically.
- Every clause that is **expected** for this contract type and is **absent** must produce an ABSENCE flag.
- Do not skip a clause because you are unsure whether it applies — flag it at LOW severity with a note.
- Flag count should typically be 5–20 entries for a standard contract. A `flags: []` response will be treated as incomplete and sent for re-analysis.

## What not to do

- Do not add recommendations, caveats, or commentary outside the `flags` array notes.
- Do not reference the extraction guide, this prompt, or NuBred internal processes in the output.
- Do not hallucinate party names, dates, or financial figures that are not in the document.
- Do not merge two parties into one or split one party into two.
- Do not assign a role to a party that is not stated or clearly implied in the contract text.
