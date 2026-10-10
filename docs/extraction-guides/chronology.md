# Chronology Section — Extraction Guide

**Source:** Doc F V2 Section — Chronology (Roadmap — data model active)
**Status:** Initial draft

---

## Important: Chronology is a deriver, not an extractor

Chronology events are generated as a **side effect of the other four sections' analyses**. The AI does not run a separate extraction pass over the source documents for this section.

The `derive()` function (implemented in Step 9) aggregates dated events from:
- **Contract**: effective_date, end_date, option exercise windows, reporting deadlines
- **Genotype**: IP filing dates, PBR grant dates
- **Phase**: phase start triggers, gate passage dates, genotype decisions
- **Protocol**: observation milestone dates, census deadlines
- **Document metadata**: file creation dates, email headers (light sweep only)

---

## What gets turned into a chronology event

| Source field | Event type | Date precision |
|-------------|-----------|---------------|
| contract.effective_date | CONTRACT_SIGNATURE | EXACT if from signed contract |
| contract.end_date (if fixed date) | CONTRACT_AMENDMENT or expiry marker | EXACT |
| contract.option_rights.exercise_window | OPTION_EXERCISE deadline | ESTIMATED from trigger |
| phase.start_trigger | PHASE_START | EXACT or ESTIMATED |
| genotype decision date | PHASE_ADVANCEMENT | EXACT if from signed minutes |
| varieties[].pbr_number + pbr_status | IP_FILING or IP_GRANT | EXACT from certificate |
| reporting_obligations[].deadline | ROYALTY_PAYMENT or HARVEST_DECLARATION | EXACT |
| document metadata date | OTHER (only if clearly an event) | ESTIMATED |

---

## Date precision

| Precision | When to use |
|-----------|------------|
| EXACT | Date appears explicitly in a signed document or official certificate |
| ESTIMATED | Date appears in email, meeting notes, or non-binding source |
| INFERRED | Date calculated from relative reference; always explain in `date_notes` |

---

## Ordering conflicts

Where two sources give different dates for the same event: the most recent confirmed source (signed document > meeting minutes > email) takes precedence. VM can manually correct dates on the timeline view.

---

## UI tab status

The Chronology tab is a vertical timeline view. It is part of the current 5-step release (`enabled: true` in the registry) but the UI tab may be added later without any backend changes — the data model is active from day one per Doc F spec.
