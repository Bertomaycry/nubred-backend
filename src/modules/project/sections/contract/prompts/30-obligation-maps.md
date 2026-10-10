# Contract Type Obligation Maps

Use the obligation map for the classified contract family as a checklist during extraction. Every MUST DO, MUST NOT DO, and RECEIVES item should either appear in the extracted fields or produce an ABSENCE flag if missing.

---

## A · IVM / Evaluation Agreement + Option (F6, F24)

Agreement between the Breeder/NuBred and an IVM for VCU trial management, variety selection, and commercial development mandate. IVM bears trial costs in exchange for Option rights and future royalty share.

| Actor | MUST DO | MUST NOT DO | RECEIVES |
|-------|---------|-------------|---------|
| Breeder / NuBred | Supply propagating material. Provide technical info on NPVs. File and maintain PBRs. Notify IVM of competing proposals (ROFR). Grant Exclusive Negotiation Period after IVM selects NPVs. | Negotiate with third parties in territory during Evaluation Period. Modify Minimum Licensing Conditions unilaterally after Option is granted. | Entry fee (if any). Future royalty share (typically ~25% net of withholding tax). Reimbursement of filing costs from royalty stream. |
| IVM | Manage importation and quarantine (Phase 1). Conduct VCU trials (Phase 2). Report annually: importation, mother plants, propagation, VCU results. Allow Breeder/Technical Manager access to all trial sites. Notify all EDVs/mutations immediately. Pay fees per Annex. | Sell or distribute plants or fruit during Evaluation Period. Sub-contract without written Breeder approval. Make crosses or create hybrids with NPVs. Disclose variety data publicly without written consent. | Right of Exclusive Negotiation (typically 6 months). Option Right on selected NPVs with pre-agreed Minimum Licensing Conditions. Cost reimbursement if Breeder licences non-selected NPVs to third parties. |

**Key fields to extract for this type (A.1–A.4):**
- Phase 1 scope (importation + quarantine), Phase 2 scope (VCU trials), Phase 3 trigger
- Release Date definition
- Option varieties vs varieties with only ROFR
- Minimum Licensing Conditions (royalty split, exclusivity, territory, minimum quantities)
- Option exercise window and consequence of non-exercise
- ROFR on non-selected NPVs
- Exclusive Negotiation Period duration
- Report types and deadlines (importation, mother plants, VCU, distribution)
- Fees during trial phase (typically none — IVM bears all costs at own risk)
- Cost reimbursement structure

---

## B · Full Commercial Licence (F1, F7, F18)

Complete licence agreement granting the Licensee the right to propagate, cultivate, and commercialise a protected variety with trademark.

| Actor | MUST DO | MUST NOT DO | RECEIVES |
|-------|---------|-------------|---------|
| Licensor / Breeder | Supply Finished Plants through Authorised Nursery. Maintain PBRs. File new IP rights. Notify Licensee of PBR transfer (1 month notice). Guarantee plant quality per Annex. | License same variety to competing operators in exclusive territory. Modify Trademark Use Policy without advance notice. | Entry fee. Royalty embedded in plant price or per kg. TM royalties (if club system). |
| Licensee | Purchase plants only from Authorised Nursery. Plant only on declared georeferenced parcels. Meet Minimum Quantities each season. Submit production and commercialisation reports. Apply TM only per TUP. Supply all fruit to Authorised Distributors. | Maintain Mother Plants. Propagate plants independently. Sell plants to third parties. Create Club Strategy with own TM without Breeder consent. Sell fruit outside Commercialisation Territory. | Exclusive commercialisation right in territory. TM licence. Right to propose extension of Minimum Quantities / Options for expanded exclusivity. |

**Key fields to extract for this type (B.1–B.4):**
- Rights bundle: propagation, cultivation, commercialisation, TM use rights — exclusive or non-exclusive per territory
- Production Plan and Minimum Quantities per season with tolerance and recovery period
- Minimum Quantities enforcement cascade
- Maximum Quantities (if defined) and consequences of exceeding
- Options structure (expand exclusivity, change territory, modify MQ)
- Entry fee: amount, currency, payment date, refundability
- Royalty structure: calculation basis, rate, invoicing method
- Reporting and payment calendar
- Authorised Nursery name(s) from Annex — can Licensee change nursery?
- Plant certification requirements and exceptions
- Prohibition on unsold plants / disposal obligation

---

## C · Nursery Propagation Licence (F2, F3, F8)

Agreement between the Breeder and a nursery authorising propagation of protected varieties.

| Actor | MUST DO | MUST NOT DO | RECEIVES |
|-------|---------|-------------|---------|
| Breeder / Principal | Supply Mother Plants or propagating material. Set and communicate annual production plan. Provide technical information. Inspect nursery facilities. Collect census declarations. | Authorise another nursery in same territory without notice. | Royalty per plant (embedded or separate). Production plan compliance confirmation. Reports. |
| Nursery / Licensee | Propagate per Production Plan. Maintain Mother Plants per authorised ratio. Submit census reports (typically 3–4 per year). Use only authorised propagating material. Destroy unsold or unauthorised plants. Allow Breeder inspection. | Maintain Mother Plants beyond authorised season. Supply plants to unauthorised parties. Exceed maximum quantities without written authorisation. Sub-contract without Breeder consent. | Non-exclusive propagation right. Access to protected variety material. Revenue from plant sales. |

**Key fields to extract for this type (C.1–C.2):**
- Minimum order / minimum quantity per season and consequences of failure
- Production ratio (Mother Plants to Finished Plants) from Annex
- Census report schedule: Mother Plant census, propagation census, sales census, destruction census — dates and content
- Penalty for undeclared propagation (typically per-kg of fruit or multiplier of declared royalties)
- For F8 (contract manufacturing): material ownership confirmation, conforming plant quality criteria, non-conformity penalty, insurance obligation

---

## D · Fruit Producer Sublicence (F15, F20)

Agreement between the IVM/Licensee and a commercial fruit grower.

| Actor | MUST DO | MUST NOT DO | RECEIVES |
|-------|---------|-------------|---------|
| IVM / Licensee | Select and approve growers. Provide quality standards (TUP / Annex). Process fruit supply and pay grower. Notify grower of authorised distributors. Guarantee continuity if TM licence terminated. | Approve growers outside licensed territory. Modify authorised distributor list without advance notice to growers. | Entire harvest from grower. Control over channel and brand. Royalty collection on behalf of Breeder. |
| Grower / Licensed Fruit Supplier | Purchase plants exclusively from Authorised Nursery. Plant only on georeferenced Land (Annex). Cultivate per quality standards. Supply entire harvest to Licensee / authorised distributor only. Notify Licensee of any PBR/TM infringement. Allow inspection of land, plants, accounts. | Reproduce or multiply plants or plant parts. Give plants to third parties. Use TM. Sell fruit to anyone other than Licensee / authorised distributor. Change land/parcel without updating the parcel Annex. | Revenue from fruit supply (price per season). Protection from uprooting if Licensor changes. |

**Key fields to extract for this type (D.1–D.3):**
- Georeferenced parcels from Annex: GPS/cadastral reference, area, training system, planting year, irrigation type
- New parcel procedure (formal Addendum required?)
- Land transfer clause (what happens when grower sells or leases land?)
- Supply exclusivity and exceptions (low-quality / industrial processing fruit)
- Authorised distributors / Fruit Marketers list from Annex — can grower change?
- Association of Producers co-signatory requirement (if grower is AoP member)
- Penalty per plant for breach of key obligations
- Termination triggers (list specific articles)
- Post-termination obligations (plant destruction timeline and supervision)
- TM licence termination continuity protection (grower protection if Licensor changes)

---

## E · Co-Breeding / Joint Breeding Agreement (F19, F23)

Highest IP complexity. Agreement between two breeding entities to jointly develop new varieties.

**Key IP ownership distinctions to extract (E.1):**
- Background IP ownership (each party's pre-existing genotypes — exclusively owned by that party, no licence granted)
- Foreground IP ownership (new genotypes created — default 50/50 unless deviation mechanism exists)
- EDV ownership (on Party A genotypes, Party B genotypes, and New Genotypes separately)
- Sideground definition and ownership (IP created outside the programme during its execution)

**Key programme execution fields (E.2):**
- Authorised crosses (Appendix reference, process for adding new crosses)
- Intermediate Selection Phase definition
- VCU responsibilities (who conducts VCU in which territory)
- Research managers (names, contact, authority — note: cannot modify the Agreement)

**Key commercialisation fields (E.3):**
- Default net royalty sharing ratio and definition of "net"
- IP cost deductions before sharing (filing costs, quarantine, certification)
- Club Project structure (Joint Club vs Single Club — 60-day window for other party to join)
- Reporting calendar (Annual Breeding Report, Commercial Report, royalty payment date)

---

## F · Consulting Agreement (F9, F10, F11)

Advisory or variety management services agreement. Key risk: non-compete and breeding limitation clauses post-termination.

**Key fields to extract (F.1–F.3):**
- Service scope: variety management, agronomic coordination, commercial development, billing management, trial management — list all activities
- Deliverables and delivery dates (quarterly, annual, etc.)
- Additional services authorisation process
- Fee type: fixed monthly vs % of royalties per managed variety vs mixed
- Payment schedule: frequency, trigger, invoice procedure
- Expense reimbursement (yes/no, categories, cap)
- Taxation clause (who bears local taxes, VAT treatment)
- Exclusivity during contract (exclusive to Breeder or can work for other clients?)
- Non-compete post-termination: duration, scope, prohibited activities, territory
- Breeding limitations post-termination: duration, scope
- Sub-contracting: pre-authorised collaborators, others requiring approval, change of control clause
