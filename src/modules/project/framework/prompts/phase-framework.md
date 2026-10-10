# NuBred Phase & Protocol Framework

## Standard Development Phases

NuBred recognises four standard development phases in two categories. Map any non-standard terminology from the source document to the closest NuBred phase using the mapping table below, and cite the original term in the `evidence` entry.

**A project can start at any phase — there is no mandatory starting point.** A client with an already-tested variety may start directly at Launch or Scale.

| Phase | Type Code | Category | Objective | Commercial activity | Key gate condition |
|-------|-----------|----------|-----------|--------------------|--------------------|
| Trial | TRIAL | EXPERIMENTAL | Screen multiple Selections with few plants per Selection to identify commercial potential. | None permitted. | All protocol observations completed + VM decision per genotype (Promote / Repeat / Discard). |
| Pilot | PILOT | EXPERIMENTAL | Validate a small number of Selections at semi-commercial scale (typically 0.5–1 ha). | None permitted. | Observations completed + production forecast validated + **Capitolato (Quality Specification) defined** + VM confirmation. Capitolato is a hard gate — Launch is blocked until it is defined. |
| Launch | LAUNCH | COMMERCIAL | First commercial phase. Variety enters market under governance structure. | Active. PBR and Brand royalties begin. | Production forecast validated + royalty reporting complete + VM advance confirmation. |
| Scale | SCALE | COMMERCIAL | Expansion commercial phase. Variety grows per planting plan. | Active. Full royalty flows operational. | Delta EBITDA calculation active in Advanced Protocol. Production forecast cycle continues. |

---

## Non-Standard Phase Terminology Mapping

When a source document uses different terminology, apply this mapping:

| Source document term | NuBred phase | Notes |
|----------------------|--------------|-------|
| Evaluation period / Evaluation phase | TRIAL or PILOT | TRIAL if no commercial scale; PILOT if semi-commercial with forecasts |
| VCU / VCU trial | TRIAL | VCU is conducted during Trial phase |
| Commercial introduction / Market introduction | LAUNCH | |
| Preliminary testing | TRIAL | |
| Market phase / Full commercial | SCALE or LAUNCH | LAUNCH if first commercial season; SCALE if expansion |
| Development phase | TRIAL or PILOT | Context-dependent — cite the source |
| Option period | TRIAL | Typically governs IVM evaluation before commercial licence |

Always show the original term and your mapping in the `evidence` entry for the phase object. If you cannot map confidently, use `CUSTOM` and describe the phase in the `objective` field.

---

## Phase Gate Logic (Doc B — Do Not Reopen)

Phase gates cannot be bypassed. For each phase transition, **NuBred verifies automatically AND the Variety Manager must confirm explicitly. Both are required — neither alone is sufficient.**

1. **Trial → Pilot**: All protocol observations for the Trial phase completed. VM has made a Promote, Repeat, or Discard decision for every genotype. Phase stays open if gate fails — VM is notified, no forced action.

2. **Pilot → Launch**: Observations completed + production forecast validated + **Capitolato (Quality Specification) defined** + VM advance confirmation. Launch is **blocked** until both the Capitolato is defined and the forecast is validated. This is a non-negotiable gate.

3. **Launch → Scale**: Production forecast validated + royalty reporting complete for Launch season + VM advance confirmation. Scale is blocked until both gates are cleared.

If a contract specifies custom gate criteria, extract them into `gate_criteria[]` and note that they supplement (not replace) the standard gates.

---

## Protocol Type by Phase Category

The protocol type switches entirely at the Experimental → Commercial boundary. Do not mix them.

| Phase Category | Phases | Protocol Type | Primary output |
|----------------|--------|---------------|----------------|
| EXPERIMENTAL | Trial, Pilot | OBSERVATIONAL | Trial report + Promote/Repeat/Discard decision per genotype |
| COMMERCIAL | Launch, Scale | COMMERCIAL | Production forecast + Harvest Actual + royalty calculation |

When a document spans the Experimental → Commercial boundary, extract **two separate protocol entries** — one OBSERVATIONAL and one COMMERCIAL.

---

## Protocol Framework — Parameter Families

All observation parameters are organised into **eight** fixed families (F8 added in DocC V4). Use the code (F1–F8) in all extractions. Families are fixed — what changes per species and project is which parameters within each family are active.

| Code | Family | Protocol type | Royalty input | Examples |
|------|--------|---------------|---------------|---------|
| F1 | Plant Characteristics | Observational | No | Vigour, BBCH phenology, growth habit, trunk diameter |
| F2 | Fruit Quality | Observational | Quality Spec input | Brix, firmness, colour, weight, bloom, organoleptic |
| F3 | Production | Observational + Commercial | Yes — delta EBITDA | kg/plant or kg/ha, pack-out %, calibre distribution |
| F4 | Phytosanitary | Observational | Eliminatory input | PSA, Botrytis, cracking, affectation %, severity |
| F5 | Post-Harvest | Observational | Quality Spec input | Shelf life, freshness, % damaged, weight loss |
| F6 | Climate | Contextual | Context only | Temperature, rainfall, humidity, radiation (no threshold) |
| F7 | Commercial | Commercial only | Yes — direct | 4-measurement forecast, harvest actuals, royalty flows |
| F8 | Agronomic Operations | Operational log | Cost side — delta EBITDA | Irrigation, fertilization, pest treatments, pruning, soil management |

**Terminology mapping examples:**
- "Soluble solids content" → Brix (F2)
- "Tree cross-section area" → Tree Vigour (F1)
- "Brown rot percentage" → Monilia affectation (F4)
- "Post-storage assessment" → Post-Harvest Evaluation (F5)
- "Irrigation log" → Agronomic Operations (F8)
- "Fertilization treatment" → Agronomic Operations (F8)

Map every parameter from the source document to the NuBred standard family code. Cite the original term.

---

## Eliminatory Criteria Levels

`eliminatory_level = null` means the parameter is **NOT eliminatory**. Do not use the string "NOT_ELIMINATORY".

| Level | Who sets it | VM can override? | Example |
|-------|-------------|-----------------|---------|
| L1 Universal | NuBred (fixed for all species) | No | PSA for yellow kiwi — confirmed infection = Discard, no exceptions |
| L2 Species Standard | NuBred proposes per species | VM can raise threshold, never lower | Botrytis >10% (kiwi), Cracking >30% (cherry), Brix minimum |
| L3 Custom | VM-defined for project-specific requirements | Yes, within declared range | Proline content for specific market, luminosity L* for premium strawberry |

When extracting protocol parameters, assign `eliminatory_level` whenever the source document indicates a fail condition, discard trigger, or mandatory threshold breach. Set `null` when no threshold breach triggers a Discard.

---

## Input Type Canonical Mapping (DocC V4)

Do NOT use old types (BBCH_SCALE, NUMERIC, INTEGER_COUNT, UPOV_CLASS, PERCENTAGE, etc.). Map to these eight canonical types only:

| Input type | Description | Key rules |
|------------|-------------|-----------|
| NUMBER | Single numeric value with unit | Brix, weight, temperature, production kg/ha |
| SCALE | Ordinal scale with configurable min/max | Always set scale_min, scale_max, scale_polarity. Never hardcode 1–5. |
| OPTION | Predefined list (BBCH stages, UPOV descriptors) | List defined in Parameter Registry per species |
| DISTRIBUTION | Histogram — % per category, must sum to 100% | Calibre distribution, size class breakdown |
| DATE | Calendar date of an event | First flowering, first harvest, last harvest |
| BOOLEAN | Yes / No | Always eliminatory when used as threshold |
| PHOTO | Camera capture | Linked to observation session and genotype |
| TEXT | Free text | Incident notes, pest identification without predefined list |
