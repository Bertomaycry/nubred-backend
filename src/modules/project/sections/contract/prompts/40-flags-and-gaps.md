# Flags and Gap Analysis

Every contract must produce a complete set of flags. The `flags` array is not optional — an empty array means you have confirmed that no clause is missing, anomalous, or imbalanced. Use LOW severity to log that a clause was checked and found adequate; use HIGH or MEDIUM for actionable findings.

## When to flag

### ABSENCE
A standard AgreeLyze clause category (C-01 through C-45) is entirely missing from the contract.

**Procedure:**
1. After completing extraction, go through the clause library from C-01 to C-45.
2. For each clause that applies to this contract type (per the obligation map above), check whether the contract contains the substance of that clause.
3. If absent: add an ABSENCE flag with the clause ID, severity (HIGH or MEDIUM depending on the clause's risk weight from the library), and a note explaining what is missing and why it matters for this specific contract.

**Important:** Not all clauses apply to all contract types. A Nursery Propagation Licence (F2/F3) does not need a Phase Structure clause (C-29) — this is expected, not an absence. Apply judgment based on the contract type identified in Step 1.

### ANOMALY
A standard clause is present but deviates materially from market standard.

**Examples:**
- Royalty rate is defined but with no cap, creating unlimited exposure for one party
- Confidentiality clause expires after 2 years — below the NuBred standard
- Termination clause requires notice even for material breach (should be express)
- Governing law is stated as a jurisdiction with no enforceability track record for plant IP cases

**Format:** "Clause C-NN is present but [description of deviation]. Market standard: [what is expected]. Risk: [what the deviation means for the party]."

### IMBALANCE
The clause is present but creates a significant power asymmetry.

**Examples:**
- Unilateral right to modify Minimum Licensing Conditions without Licensee's consent
- Licensor can terminate with 30 days notice but Licensee requires 180 days
- Penalty clause is solve et repete for one party only — the other party can dispute before paying
- IVM must allow Breeder access to all trial sites but Breeder has no reciprocal obligation

**Format:** "Clause C-NN creates an imbalance that disadvantages [PARTY ROLE]. [Description of asymmetry]. The disadvantaged party should negotiate [suggested correction]."

---

## Severity calibration

| Severity | Apply when |
|----------|-----------|
| HIGH | The absence or anomaly creates a material enforceability or governance risk that could result in unresolvable disputes, financial loss, or loss of IP control. VM must explicitly acknowledge this finding before confirming the section. |
| MEDIUM | Best-practice gap or minor risk. Important to know but does not block confirmation. VM should review and add a note explaining their acceptance. |
| LOW | Cosmetic, stylistic, or very minor. Informational. Does not require VM action. |

---

## Common absence patterns by contract type

**IVM / Evaluation Agreement (F6, F24):**
- Missing EDV clause (C-22) — HIGH in any development agreement
- Missing ROFR or Exclusive Negotiation Period (C-32, C-33) — HIGH when IVM bears trial costs
- Missing cost reimbursement structure (C-21) — HIGH
- Missing clear Release Date definition — ANOMALY (C-29)

**Full Commercial Licence (F1, F7, F18):**
- Missing Minimum Quantities enforcement cascade (C-10) — HIGH
- Missing TUP / Trademark Use Policy reference (C-08) when Brand Royalty is active — HIGH
- Missing plant certification requirement (C-14) — MEDIUM
- Missing Authorised Nursery designation (C-13) — HIGH

**Nursery Propagation Licence (F2, F3):**
- Missing census report schedule (C-35) — HIGH
- Missing penalty for undeclared propagation (C-44) — HIGH
- Missing Mother Plant destruction obligation at contract end (C-42) — MEDIUM

**Fruit Producer Sublicence (F15, F20):**
- Missing georeferenced parcel Annex (C-06) — HIGH
- Missing exclusive supply obligation (C-07) — HIGH
- Missing post-termination plant destruction obligation (C-42) — HIGH
- Missing TM licence continuity protection for grower (C-08) — MEDIUM

**Co-Breeding / Joint Breeding Agreement (F19, F23):**
- Missing Background IP ownership clause (C-23) — HIGH — this is the source of most co-breeding disputes
- Missing Foreground IP ownership clause (C-24) — HIGH
- Missing EDV ownership rules (C-22) — HIGH
- Missing authorised crosses list or process (C-29) — HIGH

**Consulting Agreement (F9, F10, F11):**
- Missing non-compete post-termination (C-43) — HIGH for Breeder-side risk
- Missing breeding limitations (C-43) — HIGH for IP protection
- Missing confidentiality survival period (C-43) — MEDIUM
