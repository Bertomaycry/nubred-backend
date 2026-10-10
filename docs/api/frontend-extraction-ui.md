# Frontend extraction UI — integration guide

Copy this file into the frontend repo. It tells the review screens how to bind
the extraction API. Endpoint shapes live in the backend docs listed below; this
file is the **mapping contract** (what broke when Identity / Parties / Penalties
showed “not found” while Gemini had already filled `payload`).

Related backend docs (same `docs/api/` folder):

| File | Use for |
|------|---------|
| [`_conventions.md`](./_conventions.md) | Base URL, auth, `X-Tenant-Slug`, upload sequence |
| [`projects.md`](./projects.md) | Create / get project |
| [`documents.md`](./documents.md) | Upload until `READY` |
| [`extractions.md`](./extractions.md) | POST start, GET latest, status enums, poll cadence |
| [`review.md`](./review.md) | GET section, PATCH fields, review-state, POST confirm |
| [`chat.md`](./chat.md) | Nubred AI: usual, source, conflict, missing, apply |

Do not invent field names from the AgreeLyze clause list (C-01–C-45). Those are
gap-analysis IDs inside `payload.flags`, not form keys.

---

## 1. Mental model

There are **five `sectionKey` values**. They are not UI accordion titles.

| `sectionKey` | Kind | When it has a payload |
|--------------|------|------------------------|
| `contract` | extractor (LLM) | First. Often ~60–90s on Gemini. |
| `genotype` | extractor | After contract, often in parallel with phase/protocol |
| `phase` | extractor | Same |
| `protocol` | extractor | Same |
| `chronology` | deriver (no LLM) | After all extractors are terminal |

**Penalties, Identity, Parties are not sections.** They are groups inside
`sections.find(s => s.sectionKey === "contract").payload`.

Pipeline:

1. Only **contract** is queued at start.
2. When contract finishes, genotype / phase / protocol are queued (may run in parallel).
3. Chronology is derived from those payloads.

The HTTP `POST /extractions` returns **202** immediately. Work continues in the
job worker. Never wait on POST for drafts.

---

## 2. Polling (required)

```
POST /api/projects/:projectId/extractions
  → 202  { extraction: { id, status: "QUEUED", sections: [...] } }

GET  /api/projects/:projectId/extractions/latest?includePayload=true
  every 2–3 seconds
```

Headers: same as other project APIs (`Authorization`, `X-Tenant-Slug`). See
[`_conventions.md`](./_conventions.md).

Rules:

- **Per-request timeout** ~15s. If a poll times out, retry. Do **not** abort the
  whole analysis after 30–60s — Gemini can take a few minutes.
- Stop polling when `extraction.status` is `SUCCEEDED` | `PARTIAL` | `FAILED`.
- **Render as soon as each section is `SUCCEEDED`.** Do not wait for
  `extraction.status` to become terminal before showing Contract.
- `409` on POST means a run is already `QUEUED`/`RUNNING`. Poll that run;
  do not start another.

Without `includePayload=true`, `payload` / `fieldMeta` / `evidence` are omitted
on list-style payloads. The review UI **must** use `includePayload=true`.

GET by id: `GET /api/projects/:projectId/extractions/:extractionRunId`
defaults to including payload (`includePayload=false` to skip).

---

## 3. Response shape (what to read)

Typical GET latest with `includePayload=true`:

```json
{
  "success": true,
  "extraction": {
    "id": "uuid",
    "status": "RUNNING",
    "provider": "gemini",
    "modelId": "gemini-3.5-flash-lite",
    "sections": [ { "sectionKey": "contract", "status": "SUCCEEDED", "payload": {}, "fieldMeta": {}, "evidenceCount": 16 } ]
  },
  "sections": [ /* same sections, plus evidence[] when includePayload=true */ ]
}
```

Prefer the top-level `sections` array when present (includes `evidence[]`).
Otherwise use `extraction.sections`.

Each section object:

```ts
{
  id: string
  sectionKey: "contract" | "genotype" | "phase" | "protocol" | "chronology"
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED"
  error: string | null
  payload: object | null      // Zod draft; null if not succeeded / failed validation
  fieldMeta: Record<string, { confidence: string, sources: string[], origin?: "VM_MANUAL" }> | null
  evidence: EvidenceRow[]     // Why? citations (top-level sections[] only)
  evidenceCount: number
}
```

`payload` uses **snake_case** and **bracket indexes** in `fieldMeta` / evidence
`fieldPath`:

```
contract_type
parties[0].name
penalties[1].amount
financial_terms.royalty_structure
```

Not `contractType`, not `parties.0.name`, not `"Party 1 — name"`.

After a VM edit, `fieldMeta[path].origin` is `"VM_MANUAL"`. After a chatbot
write it is `"CHATBOT"`. Show an “edited” badge in both cases.
Confidence becomes `PROVISIONAL` (or `MISSING` if they cleared to null).
See [`review.md`](./review.md) and [`chat.md`](./chat.md).

---

## 4. Confidence — when to show “not found”

`fieldMeta[path].confidence`:

| Value | Meaning | UI |
|-------|---------|-----|
| `CONFIRMED` | Non-null value **and** at least one evidence row | Show value; enable Why? |
| `PROVISIONAL` | Non-null value (or `[]` / `false` / `0`) **without** a citation | **Show the value.** Optional “unverified” hint. **Not** missing. |
| `MISSING` | JSON `null` | “Not found” / empty + resolve affordance |

**Badge “MISSING INFORMATION” on a group** only if every *displayed* field in
that group is `null` / empty array, or all listed paths are `MISSING`.

Do **not**:

- Treat `PROVISIONAL` as missing (this hid `economic_function`, `parties[0].role`).
- Treat a missing `fieldMeta` key as missing if `payload` has a value.
- Look up `fieldMeta["Party 1 — name"]` — that key does not exist.

Lookup helper:

```ts
function meta(fieldMeta: Record<string, { confidence: string }> | null, path: string) {
  return fieldMeta?.[path]?.confidence ?? null;
}

function isEmptyValue(value: unknown) {
  return value === null || value === undefined;
}

// Display "not found" only when the payload value is null.
// Use fieldMeta for badges / Why?, not for hiding filled strings.
```

---

## 5. Why? button

Use `section.evidence` (canonical rows from the DB). `payload.evidence` is the
same citations in LLM shape (`field_path` vs `fieldPath`).

```ts
type EvidenceRow = {
  id: string
  fieldPath: string          // e.g. "parties[0].name"
  documentName: string
  page: number | null
  charOffset: number | null
  quote: string
  frameworkElement: string | null
  documentId: string | null
}
```

Filter: `evidence.filter(e => e.fieldPath === path || e.fieldPath.startsWith(path + ".") || e.fieldPath.startsWith(path + "["))`.

---

## 6. Contract section — field map

```ts
const contract = sections.find((s) => s.sectionKey === "contract");
if (contract?.status === "QUEUED" || contract?.status === "RUNNING") {
  // spinner — do not show a catalog of "not found"
}
if (contract?.status === "FAILED") {
  // contract.error
}
if (contract?.status !== "SUCCEEDED" || !contract.payload) return;

const p = contract.payload as ContractPayload;
```

### Identity (accordion)

| UI label | Bind to | Notes |
|----------|---------|--------|
| Contract type | `p.contract_type` | Enum `F1`…`F24` or `UNCLASSIFIED`. Map to a label in the UI (`F1` → “Full commercial licence”) if you want a long name. Do **not** expect the full title string in this field. |
| Economic function | `p.economic_function` | `MF-1`…`MF-8` |
| Contract language | `p.contract_language` | |
| Governing law | `p.governing_law` | |
| Effective date | `p.effective_date` | ISO `YYYY-MM-DD` when known |
| End date | `p.end_date` | May be a sentence, not ISO |
| Evaluation period | `p.evaluation_period` | |
| Renewal mechanism | `p.renewal_mechanism` | |
| Confidence (classification) | `p.confidence_score` | 0–1 number, not a document field |

### Parties

`p.parties` is an **array**. Render one block per index.

| UI label | Bind to |
|----------|---------|
| Party N — name | `p.parties[n].name` |
| Party N — role | `p.parties[n].role` |
| Party N — country | `p.parties[n].country` |

Roles are enums: `BREEDER`, `PRINCIPAL`, `LICENSOR`, `IVM`, `LICENSEE`,
`NURSERY`, `LICENSED_GROWER`, `PACKHOUSE`, `MARKETER`, `CONSULTANT`, `LPM`,
`CONTRACTOR`, `ASSOCIATION_OF_PRODUCERS`, `UNKNOWN`.

`fieldMeta` paths: `parties[0].name`, `parties[0].role`, `parties[0].country`.

There is no `party_1_name`. “Party 1” = index **0**.

### Varieties / IP

`p.varieties[]`: `name`, `code`, `pbr_status`, `pbr_office`, `pbr_number`.

`p.trademark`: `name`, `registration`, `territory`, `included_in_contract`.

`p.edv_clause`: `present`, `ownership_rule`, `notification_required`.

### Territories and rights

`p.territories.production` | `.commercialisation` | `.exclusivity_regime`

`p.rights_granted[]`: `right_type`, `exclusive`, `territory`, `conditions`

### Money

`p.minimum_quantities`: `per_season`, `tolerance_pct`, `recovery_years`, `enforcement`

`p.financial_terms`: `entry_fee`, `royalty_structure`, `payment_calendar`

`p.option_rights`: `optioned_varieties[]`, `mlc_terms`, `exercise_window`, `rofr`

### Reporting / termination / survival

`p.reporting_obligations[]`: `report_type`, `deadline`, `content_summary`

`p.termination_triggers[]`: `event`, `type` (`EXPRESS` | `ORDINARY`), `notice_days`
(`null` on EXPRESS is expected — not a UI bug)

`p.surviving_obligations[]`: `obligation`, `duration`, `notes`

### Penalties (not a sectionKey)

**Wrong:** form fields named “Penalty schedule”, “Solve et repete”.

Those names come from AgreeLyze **C-44**. They are not keys on `payload`.

**Right:** table/list from `p.penalties[]`:

| Column | Field |
|--------|--------|
| Event | `event` |
| Amount | `amount` |
| Unit | `unit` |
| Payer | `payer` |
| Payee | `payee` |

Example from a real Gemini run:

```json
[
  { "event": "Purchasing/obtaining plants from unauthorised source", "amount": "€5.00", "unit": "per plant", "payer": "LICENSEE", "payee": "LICENSOR" },
  { "event": "False census declaration", "amount": "10x declared royalties", "unit": "flat sum", "payer": "LICENSEE", "payee": "LICENSOR" }
]
```

Show “not found” for Penalties only when `!p.penalties?.length`.

“Solve et repete” belongs in **Gaps / flags** if the model emits `flags[].clause_id === "C-44"`, not as its own input.

### Gaps / flags

`p.flags[]`: `clause_id` (`C-01`…`C-45`), `severity` (`HIGH`|`MEDIUM`|`LOW`),
`type` (`ABSENCE`|`ANOMALY`|`IMBALANCE`), `note`.

Use this list for the Gaps tab. Do **not** generate a form row per C-NN.

### Dispute

`p.dispute_resolution`: `law`, `forum`, `arbitration`, `arbitration_details`

`arbitration_details: null` when `arbitration === false` is normal (`MISSING` in
fieldMeta). Do not demand a fill.

---

## 7. Other sections (same rules)

### Genotype — `sectionKey: "genotype"`

```
payload.primary_species_botanical
payload.primary_species_common
payload.genotypes[]:
  name, breeder_code, species_botanical, species_common,
  development_status,   // SELECTION | VARIETY | UNKNOWN
  number_of_plants, linked_phases[], ip_reference, notes
```

### Phase — `sectionKey: "phase"`

```
payload.phases[]:
  name, type,              // TRIAL | PILOT | LAUNCH | SCALE | CUSTOM
  phase_category,          // EXPERIMENTAL | COMMERCIAL
  type_mapping_note, objective, duration, start_trigger,
  location,            // prose: "Lleida (Spain) and Vale do Tejo (Portugal)"
  countries[],         // ISO 3166-1 alpha-2: ["ES","PT"]; [] if unknown
  plant_count, hectares, gate_criteria[],
  capitolato_defined,      // boolean | null
  genotype_decisions[]:    // { genotype_name, decision, decision_date, notes }
                           // decision: PROMOTE | REPEAT | DISCARD
```

Project-detail world map: after Phase is confirmed, read `GET /api/projects/:projectId`
→ `phases[]` (`docs/api/projects.md`). Do **not** parse `location` on the client.
Use `countries[]` (ISO alpha-2). Empty `countries` → no marker. `category`
EXPERIMENTAL = Testing; COMMERCIAL = Commercialization. Group by country for the
popover. Review UI still binds the extraction payload above (snake_case).

### Protocol — `sectionKey: "protocol"`

```
payload.protocols[]:
  name, objective, protocol_type,   // OBSERVATIONAL | COMMERCIAL
  linked_phase, source_document,
  parameters[]: name, nubred_standard_name, parameter_family, parameter_level,
    input_type, scale_min, scale_max, scale_polarity, how_to_measure, unit,
    frequency_type, frequency_value, data_collection_window, sample_size,
    threshold, threshold_type, eliminatory_level
```

### Chronology — `sectionKey: "chronology"`

No LLM. Empty until extractors finish.

```
payload.events[]:
  event_type, description, date, date_precision, date_notes,
  actor, source_section, linked_entity_type, linked_entity_ref
```

---

## 8. Suggested component tree

```
ExtractionReview
  ProgressRow[]          // one per sectionKey; status from API
  if contract SUCCEEDED
    ContractReview
      Identity           // scalars on payload
      Parties            // map parties[]
      Varieties
      Territories / Rights
      Financial / MQ / Options
      Penalties          // map penalties[]
      Reporting / Termination / Survival
      Dispute
      Gaps               // map flags[]
  if genotype SUCCEEDED → GenotypeReview
  if phase SUCCEEDED → PhaseReview
  if protocol SUCCEEDED → ProtocolReview
  if chronology SUCCEEDED → ChronologyReview
```

While a section is `QUEUED`/`RUNNING`, show a spinner for **that** section only.
Do not pre-render its field catalog as missing.

When `SUCCEEDED`, load `GET /api/projects/:projectId/sections/:sectionKey` and
drive Confirm from `rules.canConfirm`. Field edits and Gaps-tab tracking are in
[`review.md`](./review.md). Nubred AI is in [`chat.md`](./chat.md).

---

## 9. Checklist (the bug this guide prevents)

- [ ] Poll `latest?includePayload=true`; render contract when `status === "SUCCEEDED"`.
- [ ] Bind values from `payload` with snake_case paths.
- [ ] `parties[0]` is Party 1; iterate `parties.length`.
- [ ] Penalties = `payload.penalties[]`, not “Penalty schedule” / “Solve et repete”.
- [ ] Gaps = `payload.flags[]` (C-01–C-45), not extra form fields.
- [ ] Show PROVISIONAL values; MISSING only for `null`.
- [ ] Why? uses `evidence[].fieldPath`.
- [ ] No 30–60s global timeout on the analysis.
- [ ] After SUCCEEDED, switch to GET `/sections/:sectionKey` for rules + confirm.
- [ ] PATCH `/sections/:sectionKey/fields` for edits (including conflict resolve).
- [ ] Contract Gaps tab: PATCH `/review-state` `{ "gapsTabViewed": true }` before confirm.
- [ ] Confirm only when `rules.canConfirm`; on 409 render `blocking[]`.
- [ ] Nubred AI: docs/api/chat.md.
- [ ] Project-detail map: GET project `phases[].countries` after phase confirm; skip empty.

If the network tab shows `contract_type: "F1"` and `parties[0].name` filled but
the screen says “not found”, the mapper is wrong — not Gemini and not the API.
