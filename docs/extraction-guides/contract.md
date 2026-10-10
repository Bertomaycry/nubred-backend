# Contract Section — Extraction Guide

**Source:** NuBred AI ContractExtractionGuide V1 (46 real contracts)
**Status:** Complete — ready for prompt engineering and LLM testing

---

## Purpose

This guide defines what the AI must extract when a contract is uploaded. It is the human-readable specification that was used to write `contract.schema.js` and the contract prompt fragments. If there is ever a disagreement between this guide and the schema file, the schema file wins — it is the machine contract.

---

## Extraction layers

| Layer | What happens |
|-------|-------------|
| 1. Classification | Assign contract family F1–F24 and macro-function MF-1–MF-8 from WHEREAS clauses and the object article |
| 2. Universal extraction | Fields common to all contract types (parties, varieties, territories, term, IP) |
| 3. Type-specific extraction | Fields that vary by contract family (see per-type sections below) |
| 4. Survival and risk layer | Termination, penalties, surviving obligations, dispute resolution |
| 5. Gap analysis | Flags for every absent (C-01 to C-45), anomalous, or imbalanced clause |

---

## Universal fields (all contract types)

| Field | What to extract | Format |
|-------|-----------------|--------|
| `contract_type` | Family code from 24-family taxonomy — from WHEREAS + object article | `F6`, `F1`, `UNCLASSIFIED` |
| `economic_function` | MF-1 through MF-8 macro-function | `MF-2` |
| `confidence_score` | Classification confidence | `0.0 – 1.0` |
| `contract_language` | Document language(s); if bilingual, note prevailing version | `"Bilingual: Italian + English"` |
| `governing_law` | Applicable law from Governing Law clause | `"Italian law"` |
| `effective_date` | Date of signature or effect | ISO 8601: `"2022-07-18"` |
| `end_date` | Fixed expiry or trigger description | ISO 8601 or `"Until expiry of CPVO PBR"` |
| `evaluation_period` | Duration of Trial/VCU period and its start trigger (IVM contracts only) | `"4 growing seasons from Release Date"` |
| `renewal_mechanism` | Auto-renewal terms and notice period | `"Automatic annual renewal. 90 days written notice."` |
| `parties[].name` | Full legal name including legal form | `"C.I.V. Consorzio Italiano Vivaisti soc. cons. a r.l."` |
| `parties[].role` | NuBred Glossary role from this list: BREEDER, PRINCIPAL, LICENSOR, IVM, LICENSEE, NURSERY, LICENSED_GROWER, PACKHOUSE, MARKETER, CONSULTANT, LPM, CONTRACTOR, ASSOCIATION_OF_PRODUCERS, UNKNOWN | `"IVM"` |
| `parties[].country` | Country of registration from registered office | `"Israel"` |
| `varieties[].name` | All variety/selection names in contract + annexes | `"Smeralda"` |
| `varieties[].code` | Breeder code if distinct from commercial name | `"CPVO 44847"` |
| `varieties[].pbr_status` | `PROTECTED` / `APPLICATION_PENDING` / `NOT_YET_FILED` / `UNKNOWN` | `"PROTECTED"` |
| `varieties[].pbr_office` | Granting office | `"CPVO"` |
| `varieties[].pbr_number` | Grant or filing reference | `"CPVO 44847"` |
| `trademark.name` | Trademark name | `"Dorì"` |
| `trademark.registration` | TM registration number or status | `"EUIPO application pending"` |
| `trademark.territory` | TM registration territory | `"European Union"` |
| `trademark.included_in_contract` | TM licence in this contract (true) or separate (false) | `true` |
| `territories.production` | Territory for propagation/production | `"Israel"` |
| `territories.commercialisation` | Territory for fruit/plant commercialisation | `"EU + Middle East"` |
| `territories.exclusivity_regime` | Exclusivity per right + any conditions | `"Propagation: non-exclusive. Commercialisation: exclusive, subject to MQ."` |
| `edv_clause.present` | EDV clause exists | `true` |
| `edv_clause.ownership_rule` | One-sentence ownership rule | `"EDVs belong exclusively to CIV."` |
| `edv_clause.notification_required` | Immediate notification obligation | `true` |

---

## Type-specific fields

### A — IVM / Evaluation Agreement + Option (F6, F24)

| Field | What to extract |
|-------|----------------|
| `option_rights.optioned_varieties` | Varieties carrying Option Right (not just ROFR) |
| `option_rights.mlc_terms` | Pre-agreed MLC: royalty split, exclusivity, territory, min quantities |
| `option_rights.exercise_window` | Window duration from trigger + non-exercise consequence |
| `option_rights.rofr` | ROFR on non-selected NPVs — article reference |
| Evaluation Period phases | Extract Phase 1 (importation/quarantine), Phase 2 (VCU trials), Phase 3 trigger into `phases[]` in the Phase section |
| Release Date | Definition and trigger event |
| Report types | Mother plant (by 31 March), VCU results (annually), propagation, distribution |
| Fees during trial | Explicitly note if IVM bears all costs with no fee payable |
| Cost reimbursement | Which costs IVM can recover + from what source |

### B — Full Commercial Licence (F1, F7, F18)

| Field | What to extract |
|-------|----------------|
| `rights_granted[]` | Propagation, cultivation, commercialisation, TM use — exclusive/non-exclusive per territory |
| `minimum_quantities` | Per-season quantities, tolerance %, recovery years, enforcement cascade |
| `financial_terms.entry_fee` | Amount, currency, due date, refundability |
| `financial_terms.royalty_structure` | Basis (per plant / per kg / per ha / embedded), rate |
| `financial_terms.payment_calendar` | Commercialisation report date, payment date, late interest rate |
| Authorised Nursery | Name(s) from Annex; change conditions |

### C — Nursery Propagation Licence (F2, F3, F8)

| Field | What to extract |
|-------|----------------|
| `minimum_quantities` | Minimum order per season + consequence |
| Production ratio | Mother Plants to Finished Plants ratio from Annex → into `reporting_obligations[]` |
| `reporting_obligations[]` | Census schedule: Mother Plant, propagation, sales, destruction — dates and content |
| `penalties[]` | Undeclared propagation penalty (per kg fruit or multiplier) |
| For F8 | Material ownership (Breeder's property throughout), conforming plant criteria, non-conformity penalty |

### D — Fruit Producer Sublicence (F15, F20)

| Field | What to extract |
|-------|----------------|
| Georeferenced parcels | GPS/cadastral reference, area, training system, planting year, irrigation → into supply chain section |
| New parcel procedure | Formal Addendum requirement |
| `minimum_quantities` | Supply exclusivity and exceptions |
| `penalties[]` | Per-plant penalty for key obligation breaches |
| `surviving_obligations[]` | TM licence termination continuity for grower |

### E — Co-Breeding / Joint Breeding Agreement (F19, F23)

| Field | What to extract |
|-------|----------------|
| Background IP | Each party's pre-existing genotypes exclusively owned — no licence granted |
| Foreground IP | New genotype ownership (default 50/50 or deviation mechanism) |
| `edv_clause` | EDV ownership on Background, Foreground, and New Genotypes separately |
| `option_rights` | Club Project structure — Joint Club vs Single Club, 60-day window |
| `reporting_obligations[]` | Annual Breeding Report (31 July), Commercial Report (31 July), royalty payment (30 September) |

### F — Consulting Agreement (F9, F10, F11)

| Field | What to extract |
|-------|----------------|
| Service scope | All activities in scope |
| `financial_terms.royalty_structure` | % of royalties per variety OR fixed monthly fee |
| `surviving_obligations[]` | Non-compete (1 year), breeding limitations (scope and duration), confidentiality |
| Sub-contracting | Pre-authorised collaborators + change of control clause |

---

## Gap analysis — flags output

The `flags[]` array must cover all 45 AgreeLyze clauses. Common HIGH severity absences:

| Contract type | Missing clause | Severity |
|--------------|----------------|----------|
| All | C-22 EDV clause | HIGH |
| IVM/Evaluation | C-32 ROFR | HIGH |
| IVM/Evaluation | C-21 Cost reimbursement | HIGH |
| Commercial Licence | C-10 Minimum Quantities | HIGH |
| Commercial Licence | C-08 TM Use Policy | HIGH when Brand Royalty active |
| All with commercial rights | C-40 Express termination | HIGH |
| All | C-45 Governing law / jurisdiction | HIGH |
| Co-breeding | C-23 Background IP ownership | HIGH |
| Co-breeding | C-24 Foreground IP ownership | HIGH |

---

## Evidence requirements

Every non-null field value requires one entry in `evidence[]`:
- `field_path`: dot-notation path (e.g. `"parties[0].role"`, `"minimum_quantities.tolerance_pct"`)
- `document_name`: exact filename as uploaded
- `page`: 1-based page number (null for email/text sources)
- `char_offset`: character offset if available
- `quote`: verbatim original text (preserve non-English)
- `framework_element`: the Glossary term or AgreeLyze clause ID that guided the mapping
