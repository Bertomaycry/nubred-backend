# Phase Section — Extraction Guide

**Source:** Doc B V1 — Project Structure & Phase Gates, Doc F V2 — Project Creation Flow
**Status:** Updated per DocB V1

---

## What the AI extracts

| Field | Source documents | Confidence |
|-------|-----------------|-----------|
| Phase names and types | Contracts (phase definitions in body or annexes) | Confirmed from signed contract; Provisional from email |
| Phase types (Trial/Pilot/Launch/Scale) | Same; mapped via Phase Framework | Same |
| Phase category (EXPERIMENTAL / COMMERCIAL) | Derived from type — always infer | Derived |
| Objectives | Contracts | Confirmed from signed contract |
| Duration | Contracts (primary), emails | Confirmed from contract; Provisional from email |
| Start trigger | Contracts | Confirmed from contract |
| Location | Contracts, planting plans | Confirmed from contract; Provisional from plan draft |
| Countries (ISO alpha-2) | Derived from location / production territory | Confirmed if countries are named; empty if unknown |
| Number of plants / hectares | Contracts, planting plans | Confirmed from signed contract |
| Gate criteria | Contracts (annexes), protocols (gate requirements) | Confirmed if protocol is official; Provisional if draft |
| Capitolato defined (Pilot only) | Quality Specification document, contract reference | Confirmed if document present; null if not yet defined |
| Genotype decisions (Promote/Repeat/Discard) | Meeting notes, email communications | Confirmed if from official meeting minutes; Provisional if from email |

---

## Important: a project can start at any phase

There is no mandatory starting point. A client with an already-tested variety may begin directly at Launch or Scale. Do not flag the absence of a Trial phase as an error. The absence of earlier phases is valid and should not generate a conflict.

---

## Phase categories — always derive and populate

Phases belong to one of two categories (DocB). This field must always be set — derive it mechanically from `type`:

| Phase type | Category | Protocol type | Royalties |
|------------|----------|---------------|-----------|
| TRIAL | EXPERIMENTAL | OBSERVATIONAL | Not active |
| PILOT | EXPERIMENTAL | OBSERVATIONAL | Not active |
| LAUNCH | COMMERCIAL | COMMERCIAL | Active — PBR + Brand |
| SCALE | COMMERCIAL | COMMERCIAL | Active — Full |
| CUSTOM | null | Unknown | Unknown |

---

## Non-standard phase terminology

Contracts may use terms like "Evaluation Period", "VCU Phase", "Commercial Introduction", or "Preliminary Testing". Every non-standard term must be mapped to a NuBred standard phase type using the Phase Framework mapping table. The mapping must be cited in `type_mapping_note`.

---

## Gate criteria — standard conditions per phase (DocB V1)

Extract both NuBred standard conditions and any project-specific conditions from the contract. Standard gates by phase:

| Phase | Standard gate conditions |
|-------|--------------------------|
| TRIAL → PILOT | All protocol observations completed + VM makes Promote/Repeat/Discard decision per genotype. If gate fails: phase stays open, VM is notified. |
| PILOT → LAUNCH | Observations completed + production forecast validated + **Capitolato (Quality Specification) defined** + VM advance confirmation. Capitolato is a **hard gate — Launch is blocked until it is defined**. |
| LAUNCH → SCALE | Production forecast validated + royalty reporting complete for Launch season + VM advance confirmation. |

If the contract is silent on gate criteria, list only the NuBred standard conditions for that phase type. The VM can add custom gate criteria manually after extraction.

---

## Capitolato field (Pilot phase only)

`capitolato_defined` is relevant only for the PILOT phase entry:
- Set to `true` if the contract or attached document confirms a Quality Specification has been defined.
- Set to `false` if the contract states that the Capitolato is pending or not yet agreed.
- Set to `null` for all other phase types.

The Capitolato may appear in the source document as: "Quality Specification", "Cahier des charges", "Disciplinare", "Capitolato di qualità".

---

## Common conflict scenarios

| Conflict | Extraction behaviour |
|----------|---------------------|
| Contract states 2-year Trial, email states 3-year Trial | Extract both; flag `CONFLICTING`; cite both sources |
| Contract mentions Pilot gate but Capitolato document absent | Set `capitolato_defined: false`; flag for VM review |
| Genotype decision in email contradicts meeting minutes | Extract most authoritative (signed minutes > email); flag `CONFLICTING` |

---

## Blocking rules

- **At least one active phase is required.** A project with no phases cannot be confirmed.
- Every phase must have a `type` assigned (not null) before confirmation.
- `phase_category` must be populated — derive from `type` if not explicit in source.

---

## Genotype decisions

If the contract or meeting notes document a Promote / Repeat / Discard decision for a specific variety at the end of a phase, extract it into `genotype_decisions[]`. This is a historical record of what was decided at a specific gate — distinct from the current development status in the Genotype section.

Discarded genotypes are **never deleted from NuBred** — they are archived with full observation history. This is a governance requirement.
