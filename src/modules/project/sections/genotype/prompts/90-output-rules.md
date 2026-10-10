# Genotype Output Rules

- Return a single valid JSON object. No text outside the JSON.
- If no genotypes are found in the documents, return `"genotypes": []`.
- Every genotype entry must have a `name`. All other fields may be `null` if not found.
- The `linked_phases` array may be empty `[]` if phase linkage is not stated.
- `number_of_plants` must be an integer or `null` — never a string.
- Dates (e.g. IP filing date) use ISO 8601 format (YYYY-MM-DD or YYYY).
- Do not create a genotype entry for a rootstock — rootstocks are not varieties under management.
- Do not hallucinate variety names. Extract only names that appear explicitly in the documents.
