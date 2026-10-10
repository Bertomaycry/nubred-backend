# Contract Classification

## Step 1 — Identify the Economic Function

Before assigning a family code, determine which macro-function (MF) this contract performs:

| Code | Name | Primary indicator |
|------|------|-------------------|
| MF-1 | Propagation | Nursery is authorised to propagate and sell plants. Breeder supplies mother plants or propagating material. |
| MF-2 | Evaluation | IVM conducts VCU trials at own cost. No commercial activity during the agreement. Option or ROFR is the compensation. |
| MF-3 | VMC Development | Breeder delegates commercial development of a variety to an IVM. IVM manages royalty collection and distribution on behalf of the Breeder. |
| MF-4 | Fruit Distribution | Grower supplies the full harvest to a licensee/distributor. Governs the downstream commercial relationship between grower and distributor/marketer. |
| MF-5 | Terminal Licence | End-point commercial licence to a grower or operator to cultivate and sell under the brand. |
| MF-6 | Territory Positioning | Primarily governs exclusivity, territory allocation, and market positioning. Often combined with MF-3 or MF-5. |
| MF-7 | Germplasm | Co-breeding, joint breeding, or germplasm exchange. IP ownership of new genotypes is the central issue. |
| MF-8 | Operational Support | Consulting, variety management services, technical advisory. Fee-based; no primary IP right granted. |

Ask yourself: **Who collects royalties? Who bears commercial risk? What activity is the primary authorised act?** Use these three questions to assign MF.

## Step 2 — Assign the Family Code

| Family code | Description | Typical MF |
|-------------|-------------|-----------|
| F1, F7, F18 | Full Commercial Licence — Licensor grants Licensee the right to propagate, cultivate, and commercialise a protected variety with TM. Long-term commercial contract. | MF-5 |
| F2, F3 | Nursery Propagation Licence — Annual (F2) or multi-annual (F3) nursery authorisation to propagate protected varieties. | MF-1 |
| F8 | Contract Manufacturing (Conto Lavorazione) — Breeder supplies propagating material; nursery propagates as a service. Material remains Breeder's property. | MF-1 |
| F6, F24 | IVM / Evaluation Agreement + Option — IVM manages importation, quarantine, and VCU trials in exchange for Option rights and future royalty share. | MF-2 |
| F9, F10, F11 | Consulting Agreement — Agronomic, commercial, or variety management services for a fee. Non-compete and breeding limitations are the key risk clauses. | MF-8 |
| F15, F20 | Fruit Producer Sublicence — Agreement between IVM/Licensee and a commercial fruit grower. Grower cultivates on declared parcels and supplies full harvest. | MF-4 |
| F19, F23 | Co-Breeding / Joint Breeding Agreement — Two breeding entities jointly develop new varieties. IP ownership of new genotypes is split. Highest IP complexity. | MF-7 |

For contracts that combine multiple functions (e.g. a licence that also includes a consulting fee), assign the primary family code and note the secondary functions in the `flags` array as informational LOW items.

If no family matches, use `UNCLASSIFIED` and explain why in a flag.

## Step 3 — Confirm with internal checks

After classification:
- Check the WHEREAS recitals: do they confirm your classification?
- Check the Object clause: does it match the economic function you assigned?
- If there is a contradiction (e.g. WHEREAS says "evaluation" but the Object clause grants commercial rights), note the discrepancy in a flag (ANOMALY).

Record the family code in `contract_type`, the macro-function in `economic_function`, and your confidence in `confidence_score`.
