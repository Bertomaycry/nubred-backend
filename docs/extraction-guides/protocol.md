# Protocol Section — Extraction Guide

**Source:** Doc C V4 — Protocol & Parameter Schema (canonical), Doc K V3 — Protocols & Observations Module, Doc F V2
**Status:** Updated per DocC V4 — replaces all previous versions

---

## What the AI extracts

| Field | Source documents | Confidence |
|-------|-----------------|-----------|
| Protocol name and objective | Technical protocol documents (primary), contract annexes | Confirmed from official protocol; Provisional from draft |
| Protocol type (OBSERVATIONAL / COMMERCIAL) | Protocol title/phase linkage, contract phase structure | Confirmed if explicit; inferred from phase linkage otherwise |
| Phase linkage | Protocol title/introduction, contract phase structure | Confirmed if explicit; inferred otherwise |
| Parameter family (F1–F8) | Protocol parameter definitions | Confirmed — family assignment is a NuBred rule applied during extraction |
| Observation parameters (name, input type, method) | Technical protocols (primary), VCU guidelines | Confirmed from official protocol; Provisional from draft |
| Input type (8 canonical types) | Parameter definitions in protocol | Confirmed from official protocol |
| Scale min/max/polarity | Parameter definitions | Confirmed from protocol; Provisional if inferred from standard |
| Frequency type and value | Technical protocols, contract annexes | Confirmed from official protocol; Provisional from email discussion |
| Data collection windows | Technical protocols | Same |
| Sample sizes | Technical protocols | Same |
| Quality thresholds | Technical protocols, Quality Specification | Confirmed from official document |
| Eliminatory criteria | Technical protocols (explicit) | Confirmed from protocol; flag if threshold inferred from context |
| F8 Agronomic Operations | Protocol annexes, agronomic schedule documents | Confirmed from official protocol; Provisional from draft plan |

---

## Protocol type — determine this first (DocC V4)

Every protocol belongs to one of two types. This is the most important architectural distinction.

| Protocol type | Active phases | Key output | Key parameter families |
|---------------|---------------|------------|------------------------|
| OBSERVATIONAL | Trial, Pilot | Trial report + Promote/Repeat/Discard | F1, F2, F3, F4, F5, F6, F8 |
| COMMERCIAL | Launch, Scale | Production forecast + royalty calculation | F3, F7 |

A project does **not** continue the Observational protocol into Launch — it switches to Commercial entirely. If a single source document covers both phases, extract two separate protocol entries.

---

## Parameter family mapping (DocC V4 — 8 families)

Every parameter must be assigned to a family. **F8 is new in DocC V4 — previous guides listing F1–F7 only are obsolete.**

| Source document term | NuBred standard name | Family |
|---------------------|---------------------|--------|
| Soluble solids content | Brix | F2 |
| Tree cross-section area / trunk circumference | Tree Vigour | F1 |
| Cane growth / plant vigour | Plant Vigour | F1 |
| BBCH stage / phenological stage | Phenology (BBCH) | F1 |
| Brown rot / Monilia affectation | Monilia affectation | F4 |
| Cracking percentage | Cracking | F4 |
| PSA / Pseudomonas syringae | PSA susceptibility | F4 |
| Botrytis / grey mould | Botrytis cinerea affectation | F4 |
| Cold storage assessment / shelf life test | Post-Harvest Evaluation | F5 |
| Yield / production per plant | Production | F3 |
| Pack-out percentage | Pack-out % | F3 |
| Calibre distribution / size class breakdown | Calibre distribution | F3 |
| Fruit weight | Average Fruit Weight | F2 |
| Calibre / size | Fruit calibre | F2 |
| Colour score | Colour | F2 |
| Bloom (waxy coating) | Bloom | F2 |
| Dry matter % / DM% | Dry Matter % | F2 |
| Firmness / penetrometer | Fruit Firmness | F2 |
| Organoleptic / tasting panel | Organoleptic (Aspect + Flavour) | F2 |
| Fruit Set Count | Fruit Set Count | F7 |
| Growing Stage Diameter / diameter measurement | Growing Stage Diameter | F7 |
| Ripening Stage Weight | Ripening Stage Weight | F7 |
| Harvest Actual / declared production | Harvest Actual | F7 |
| Temperature / climate / weather station | Temperature / Climate | F6 |
| Light intensity / lux | Light intensity | F6 |
| Irrigation log / watering schedule | Irrigation (Agronomic) | F8 |
| Fertilization / treatment / spray | Fertilization / Foliar treatment | F8 |
| Pruning / defoliation / topping | Pruning / Training | F8 |
| Soil management / hoeing / mulching | Soil management | F8 |

Always cite the original term in the source document (via `evidence`).

---

## Input types — canonical mapping (DocC V4)

Use only these eight types. **Do not use deprecated types from previous versions (BBCH_SCALE, NUMERIC, UPOV_CLASS, INTEGER_COUNT, PERCENTAGE, WEIGHT_KG, etc.).**

| Input type | When to use | Key rules |
|------------|-------------|-----------|
| NUMBER | Any single quantitative value with a unit | Include unit in `unit` field |
| SCALE | Ordinal scale (vigour, firmness, disease severity) | Always set scale_min, scale_max, scale_polarity. NOT hardcoded to 1–5. |
| OPTION | Predefined fixed list (BBCH stages, UPOV growth habit, insolation type) | List defined in Parameter Registry per species |
| DISTRIBUTION | Histogram where % categories must sum to 100% | Calibre distribution only. Cannot store as single scalar. |
| DATE | Calendar date of an event | First flowering, first harvest, last harvest |
| BOOLEAN | Yes / No | Always eliminatory when used as a threshold (e.g. PSA confirmed Y/N) |
| PHOTO | Camera capture | Linked to observation session and genotype |
| TEXT | Free text | Incident notes, anomaly documentation, unclassified pest identification |

### SCALE input type rules
- `scale_min` and `scale_max` must always be populated for SCALE type (e.g. min=1, max=5 for a 1–5 scale; min=1, max=3 for a 1–3 scale).
- `scale_polarity` must be HIGHER_BETTER or LOWER_BETTER.
- Do not assume 1–5 — extract the actual range from the protocol. Blueberry protocols use 1–3 extensively.

### DISTRIBUTION input type rules
- The parameter stores a set of percentage values per size class (e.g. <12mm 5%, 12-14mm 18%, 14-18mm 42%).
- Do not set a scalar `threshold` — describe the category structure in `how_to_measure`.
- This is the only input type that stores structured JSON in `ObservationValue.structuredValue`.

---

## Frequency types (DocC V4 — 4 types)

| Frequency type | Definition | Example |
|----------------|------------|---------|
| CALENDAR_FIXED | Fixed calendar schedule: daily, weekly, bi-weekly, monthly | Plant vigour: bi-weekly. Climate: daily. |
| EVENT_BASED | Triggered by a biological or agronomic event | Fruit quality: per harvest event. Shelf life: at 1d, 3-4d, 7d, 14d, 21d from harvest. |
| PHASE_GATE | Required before phase advancement — blocks Promote until complete | Quality Specification assessment before Trial→Pilot gate. |
| ON_DEMAND | Manually triggered for anomalies or incidents | Hail damage documentation. Unexpected disease outbreak. |

---

## Eliminatory criteria levels

`eliminatory_level = null` means NOT eliminatory. **Never use the string "NOT_ELIMINATORY".**

| What the source document says | Level |
|-------------------------------|-------|
| "Cannot be exceeded in any circumstances", "absolute limit", "L1 universal" | L1 |
| PSA confirmed positive for yellow kiwi | L1 — absolute, no VM override |
| "NuBred minimum", "species standard", "industry standard" — VM can raise but not lower | L2 |
| Botrytis >10% at harvest (kiwi), Cracking >30% (cherry), Brix minimum | L2 |
| "Project-specific", "agreed between parties", "VM-defined" | L3 |

When unclear, default to L2 and flag for VM review. The VM can reclassify at confirmation.

---

## F8 Agronomic Operations extraction

F8 parameters are different from observations — they are an **operational log of agronomic interventions**. Required for GLP-compliant trial reports and delta EBITDA cost calculation.

Extract F8 entries when the protocol or annex describes:
- Irrigation schedule (volumes, intervals, water quality parameters)
- Fertilization or foliar treatment programme (product names, doses, timing)
- Pest/disease treatment schedule
- Pruning, defoliation, or topping schedule
- Soil management operations

For each F8 parameter, use input_type `TEXT` (for log entries) or `NUMBER` (for volumetric measurements like m³/ha).

---

## Blocking rules

- At least one protocol must be identified.
- Every protocol must have at least one parameter.
- Every protocol must be linked to a phase (TRIAL, PILOT, LAUNCH, SCALE, or CUSTOM).
- Every protocol must have a `protocol_type` assigned (OBSERVATIONAL or COMMERCIAL).

---

## Field Observer assignment

Field Observer assignments are NOT extracted from documents. They are assigned by the VM after the Protocol section is confirmed. The `GET /api/protocols/active` endpoint serves confirmed protocol data to Field Observer mobile apps and NuBred Node hardware using the same schema — source field (Manual/Node/Vision) is the only difference.
