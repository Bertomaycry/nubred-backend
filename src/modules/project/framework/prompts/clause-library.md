# AgreeLyze Clause Library — 45 Standard Clause Categories

Every uploaded contract is cross-referenced against these 45 standard clause categories. For each:
- **Present** → extract its content according to the relevant section schema.
- **Absent** → add an ABSENCE flag in the `flags` array with the clause ID and an appropriate severity (HIGH or MEDIUM).
- **Present but anomalous** → add an ANOMALY flag explaining the deviation.
- **Present but imbalanced** → add an IMBALANCE flag describing the power asymmetry.

**Clause IDs use the format C-NN** (C-01 through C-45).

> NOTE: The official AgreeLyze clause IDs and full descriptions are provided separately by the client (the complete AgreeLyze v3 library document). This file contains the inferred scaffold from the NuBred extraction guide. Replace this file with the official library when received.

---

## Category A — Contract Identity & Parties

| ID | Clause | Severity if absent |
|----|--------|--------------------|
| C-01 | Parties and legal designations (preamble) | HIGH — contract cannot be assigned to actors without identified parties |
| C-02 | Recitals / WHEREAS clauses | MEDIUM — context for interpretation may be missing |
| C-03 | Object clause (grant of rights / economic function) | HIGH — the primary right granted must be explicit |
| C-04 | Defined terms | MEDIUM |

## Category B — Rights Bundle

| ID | Clause | Severity if absent |
|----|--------|--------------------|
| C-05 | Propagation right (exclusive / non-exclusive, territory) | HIGH for nursery and IVM contracts |
| C-06 | Cultivation right (exclusive / non-exclusive, territory) | HIGH for grower contracts |
| C-07 | Commercialisation right (exclusive / non-exclusive, territory) | HIGH for commercial contracts |
| C-08 | Trademark use right / Trademark Use Policy (TUP) reference | HIGH when Brand Royalty is active |
| C-09 | Sub-licensing authorisation | MEDIUM |

## Category C — Production Plan & Quantities

| ID | Clause | Severity if absent |
|----|--------|--------------------|
| C-10 | Minimum Quantities (per season, tolerance, recovery period) | HIGH — non-compliance triggers cannot be tracked |
| C-11 | Maximum Quantities | MEDIUM |
| C-12 | Options structure (expand territory / increase quantities) | MEDIUM |
| C-13 | Authorised sources (nursery, propagating material) | HIGH — supply chain integrity depends on this |
| C-14 | Plant certification requirements | MEDIUM |
| C-15 | Prohibition on unsold plant carryover / destruction obligation | MEDIUM |

## Category D — Financial Terms

| ID | Clause | Severity if absent |
|----|--------|--------------------|
| C-16 | Entry fee (amount, currency, payment date, refundability) | HIGH if exclusivity is granted |
| C-17 | Royalty structure (basis, rate, calculation method) | HIGH |
| C-18 | Royalty payment calendar (due dates, invoice procedure) | HIGH |
| C-19 | Late payment penalty / interest rate | MEDIUM |
| C-20 | Withholding tax treatment | MEDIUM for cross-border royalty flows |
| C-21 | Cost reimbursement structure (for IVM / development contracts) | MEDIUM |

## Category E — IP & Variety Rights

| ID | Clause | Severity if absent |
|----|--------|--------------------|
| C-22 | EDV clause (ownership, notification obligation) | HIGH — UPOV compliance requires this in most agreements |
| C-23 | Background IP ownership (pre-existing genotypes) | HIGH for co-breeding contracts |
| C-24 | Foreground IP ownership (new genotypes created under the agreement) | HIGH for co-breeding contracts |
| C-25 | Sideground IP definition and ownership | MEDIUM |
| C-26 | PBR filing and maintenance obligations | HIGH when PBR is not yet granted |
| C-27 | IP transfer notification (30 days notice) | MEDIUM |
| C-28 | Non-challenge obligation | MEDIUM |

## Category F — Phase Structure & Options

| ID | Clause | Severity if absent |
|----|--------|--------------------|
| C-29 | Phase definitions and duration | HIGH for development agreements |
| C-30 | Release Date definition and trigger | HIGH for IVM evaluation agreements |
| C-31 | Option rights and exercise window | HIGH when an Option is referenced |
| C-32 | Right of First Refusal (ROFR) on non-selected varieties | MEDIUM |
| C-33 | Exclusive Negotiation Period | MEDIUM |
| C-34 | Minimum Licensing Conditions (pre-agreed in Option contracts) | HIGH when Option is present |

## Category G — Reporting & Compliance

| ID | Clause | Severity if absent |
|----|--------|--------------------|
| C-35 | Reporting obligations (types, deadlines, content) | HIGH |
| C-36 | Inspection and audit rights | MEDIUM |
| C-37 | Sub-contracting approval process | MEDIUM |
| C-38 | Change of control clause | MEDIUM |
| C-39 | Land transfer / change of operator clause | MEDIUM for grower contracts |

## Category H — Termination & Survival

| ID | Clause | Severity if absent |
|----|--------|--------------------|
| C-40 | Express termination triggers (art. 1456 or equivalent) | HIGH |
| C-41 | Ordinary termination (notice period, conditions) | HIGH |
| C-42 | Post-termination obligations (plant destruction, return of material) | HIGH |
| C-43 | Surviving obligations (confidentiality, IP, non-compete duration) | HIGH |
| C-44 | Penalties and solve et repete | MEDIUM |

## Category I — Dispute Resolution

| ID | Clause | Severity if absent |
|----|--------|--------------------|
| C-45 | Governing law, jurisdiction, and arbitration | HIGH — enforceability risk without this |

---

## Flag Severity Guidelines

| Severity | When to use |
|----------|-------------|
| HIGH | Absence or anomaly creates a material enforceability or governance risk. VM must explicitly acknowledge. |
| MEDIUM | Absence or anomaly represents a best-practice gap or minor risk. VM should be aware. |
| LOW | Cosmetic or minor. Informational only. |

## Flag Type Definitions

| Type | Definition |
|------|-----------|
| ABSENCE | A standard clause category is entirely missing from the contract. |
| ANOMALY | The clause is present but deviates materially from market standard in a way that creates risk. Describe the deviation. |
| IMBALANCE | The clause is present but creates a significant power asymmetry between the parties. Identify which party bears the disadvantage. |
