# Genotype Section — Extraction Guide

**Source:** Doc F V2 Section 2 — Genotype + NuBred Glossary Section 1 (Genetic Material)
**Status:** Initial draft — to be refined with client input before full implementation

---

## Purpose

This guide defines what the AI must extract for the Genotype section. It complements `genotype.schema.js` — the schema is the machine contract, this guide is the human specification.

---

## What the AI extracts

| Field | Source documents | Confidence |
|-------|-----------------|-----------|
| Species (botanical + common name) | All contracts (preamble), protocols (genotype list), IP certificates | Confirmed from signed contract or IP certificate; Provisional from email |
| Variety/selection names | Contracts (variety name in preamble and annexes), protocols (genotype codes), emails (variety names in coordination) | Confirmed from signed contract; Provisional from email |
| Internal breeder codes | Protocols and trial agreements | Confirmed if from official protocol; Provisional if from draft or email |
| Number of plants per genotype | Planting plans and contracts | Confirmed from signed planting plan; Provisional otherwise |
| Development status (Selection vs Variety) | IP certificates (primary), contracts (IP schedules) | Confirmed if PBR certificate uploaded; Provisional if inferred from contract language |
| Linked phases | Contracts (phase definitions with variety lists) | Confirmed from signed contract; Provisional from email |
| IP reference (PBR/patent number) | IP certificates, contract annexes | Confirmed from official certificate; Provisional from contract reference |

---

## Common conflict scenario

The most common conflict: the same variety referred to with different names in different documents — breeder code in the contract, commercial name in the protocol, informal nickname in emails.

**Resolution:** NuBred flags as Conflicting and shows both versions. VM confirms the canonical name. The non-canonical name is archived as an alias.

---

## Blocking rules

- **Any genotype without a species assigned blocks confirmation.** Species is the minimum required field. The VM must fill it manually or upload a document that identifies the species before confirming.

---

## What to do with rootstocks

Do not create a genotype entry for rootstocks (e.g. Hayward, Tomuri for kiwi). Rootstocks are used as a base for grafting and are not the variety under management. Extract rootstock information into the supply chain / planting unit context when that section is implemented.

---

## Extraction notes

- Merge duplicates. The same genetic identity may appear under different names across documents. When merging, preserve both name forms in `notes` and cite both documents.
- EDV relationships: if the contract flags a genotype as an EDV of another, note this in `notes` and ensure the Contract section's EDV clause is also populated.
- "NPV" (New Plant Variety) in IVM contracts = SELECTION status until PBR is granted.
