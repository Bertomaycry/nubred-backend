# Contract Extraction Fixtures

This directory holds golden-set test fixtures for the Contract section extraction eval harness (Step 5).

## File naming

```
<identifier>.input.txt      — Redacted contract text (party names, figures, territories anonymised)
<identifier>.expected.json  — Expected extraction output validated against contractExtractionSchema
```

## Redaction rules

Real client contracts are confidential. Before adding a fixture:
1. Replace company names with placeholders: Party A, Party B, Nursery X, Grower Y.
2. Replace financial figures with representative but not real values.
3. Replace specific territories with region-level descriptions (e.g. "Country in Central Europe").
4. Replace actual PBR numbers with synthetic numbers in the same format.
5. Keep the structural elements (clause order, annex references, phase structure) intact — these are what the eval tests.

## Current fixtures

| File | Purpose |
|------|---------|
| `smeralda-f1.input.txt` | **Use this for Gemini testing.** Short F1 licence (~150 lines). Covers parties, IP, phases, money, and a small protocol set. |
| `smeralda-f1-full.input.txt` | Long dense version of the same contract. Use later for eval completeness, not for free-tier Gemini runs. |

## How to add a fixture

```bash
# Redact the contract, save as .input.txt
# Run extraction against it:
node scripts/run-extraction.js --section contract --input fixtures/golden/agropro.input.txt --out fixtures/golden/agropro.expected.json

# Review the output, correct any wrong values, commit.
```

The eval harness in Step 5 will compare live extraction output against these expected files using a field-level diff that ignores quote whitespace and date format variations.
