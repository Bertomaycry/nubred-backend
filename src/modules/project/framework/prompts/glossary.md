# NuBred Domain Glossary

**Mandatory rule: use only the terms defined here. Never substitute synonyms.**
Contracts may be written in Italian, Spanish, French, or English — always extract using these English NuBred standard terms. When a source document uses different language (e.g. "Selezione" in Italian, "período de evaluación" in Spanish), map it to the NuBred term and cite the original in the `evidence` array.

---

## 1 · Genetic Material

| Term | NuBred Definition |
|------|-------------------|
| Genetic Material | Any plant material carrying heritable traits — seeds, cuttings, buds, tissue, pollen, or whole plants. The broadest category. |
| Genotype | A specific genetic identity — any individual plant or group of plants sharing the same genetic makeup, whether or not protected by IP rights. |
| Selection | A genotype identified as potentially valuable through breeding or observation but not yet granted plant variety protection. A Selection may become a Variety. |
| Variety | A genotype that has been granted plant variety protection (PBR, CPVR, or equivalent). In NuBred, **Variety always implies protected status**. |
| EDV (Essentially Derived Variety) | A variety predominantly derived from another protected variety (the initial variety). Under UPOV, the holder of the initial variety retains rights over EDVs. EDVs discovered during a NuBred project must be reported immediately. |
| Propagating Material | Any plant material used to reproduce a variety — seeds, cuttings, runners, buds, grafts, tissue culture, mother plants. Specific forms authorised per contract. |
| Mother Plant | A plant retained specifically to produce propagating material. Tracked per contract obligations (authorised existence and destruction). |
| Rootstock | A plant whose root system is used as the base onto which a scion (the desired variety) is grafted. Common kiwi rootstocks: Hayward, Tomuri. |

---

## 2 · Project Structure & Actors

Roles in NuBred are always **project-specific** — a user can be Variety Manager in one project and Grower in another. There is no global role. Every actor has one of two states: **Active** (account activated, full access per role) or **Pending** (invited but account not yet activated; VM can see their node but cannot access actor data).

| Term | NuBred Definition |
|------|-------------------|
| Project | The primary organisational unit in NuBred. Represents the full lifecycle of one or more varieties in a defined geographic ecosystem. Every actor, contract, phase, observation, and obligation belongs to a Project. |
| Sub-Project | A Project nested within a parent Project. Used when a variety is tested or developed in multiple distinct locations or under distinct agreements that share a common origin but operate independently. |
| Ecosystem | The full network of actors, relationships, contracts, and commercial flows surrounding a variety. Represented as an interactive diagram in NuBred. |
| Variety Manager (VM) | The actor responsible for governing the project ecosystem. Typically a breeder, licensor, or IVM. The only role that creates projects, invites actors, and makes all phase gate decisions. Sees all sections. |
| Independent Variety Manager (IVM) | A company or individual with a mandate from the Breeder to develop and commercialise a variety in a specific territory. Manages the ecosystem on behalf of the Breeder. |
| Breeder | The entity that created or owns the IP rights to a variety. May also act as Variety Manager, or may delegate this role to an IVM. |
| Licensed Grower | A producer authorised by the Variety Manager to plant and harvest a specific variety under a licence agreement. Has defined planting rights, reporting obligations, and royalty obligations. |
| Nursery | A facility authorised to propagate and supply licensed plant material under a propagation licence. Invited by VM; sees only genotypes linked to their contracts. |
| Packhouse | A facility that receives harvested fruit from Licensed Growers, sorts and grades it, and prepares it for commercial sale. |
| Marketer | The commercial entity responsible for selling fruit to retail or wholesale channels. May be the same as the Packhouse or separate. |
| Retailer | The end-of-chain commercial actor selling fruit to the consumer. |
| Field Observer | A functional role added to any existing NuBred account. The human NuBred Node — collects observation data in the field using the mobile interface. A user can be Grower AND Field Observer in the same project. Assigned by VM to specific genotypes and farms. Will be replaced by NuBred Node hardware when deployed. |
| NuBred Admin | Eagle Apps back-office role. Manages the Benchmark Registry, Glossary, Clause Library, and Protocol templates. Not visible in the client-facing MVP interface. |
| Actor State — Active | Actor has accepted the invitation and activated their NuBred account. Full access to role-permitted sections. |
| Actor State — Pending | Actor has been invited by VM but has not yet activated their account. VM sees their node in the Supply Chain diagram but cannot interact with actor data. |

---

## 3 · Development Phases

A project can **start at any phase** — there is no mandatory starting point. A client with an already-tested variety may start directly at Launch.

Phases are divided into two categories:
- **Experimental** (Trial, Pilot) — scientific evaluation, no royalties, Observational Protocol applies.
- **Commercial** (Launch, Scale) — royalties active, Commercial Protocol applies, Capitolato mandatory.

| Term | NuBred Definition |
|------|-------------------|
| Trial | Experimental phase. Screen multiple Selections with few plants per Selection. No commercial activity. Gate: all protocol observations completed + VM Promote/Repeat/Discard per genotype. |
| Pilot | Experimental phase. Validate a small number of Selections at semi-commercial scale (typically 0.5–1 ha). Production forecast cycle begins. **Capitolato (Quality Specification) must be defined before Pilot closes** — this is a hard gate for Launch. |
| Launch | First commercial phase. PBR and Brand royalties become active. Production forecasts and harvest actuals mandatory. Gate: forecast validated + royalty reporting complete + VM confirmation. |
| Scale | Commercial expansion phase. Full planting plan from contract governs growth. Delta EBITDA calculation active in Advanced Protocol. |
| Phase Gate | Conditions that must be met before a project can advance phases. NuBred verifies automatically; VM must then confirm explicitly. Both checks are required — neither alone is sufficient. Cannot be bypassed. |
| Capitolato | Italian term for Quality Specification. Defines minimum quality standards fruit must meet for brand royalty payment. Mandatory gate for Pilot → Launch — Launch is blocked until the Capitolato is defined. Synonyms in contracts: "Quality Specification", "Cahier des charges", "Disciplinare". |
| Promote | VM decision to advance a genotype from the current phase to the next. Creates a new phase entry for that genotype and locks previous phase data. |
| Repeat | VM decision to continue the current phase for a genotype — more data needed. Extends current phase; new observation cycle opens. |
| Discard | VM decision to remove a genotype from active development. Never deleted — archived with full observation history. This is a governance requirement. |

---

## 4 · Contracts & Legal Instruments

| Term | NuBred Definition |
|------|-------------------|
| Plant Variety Protection (PVP / PBR) | IP right protecting a plant variety. Grants exclusive rights over propagation, production, and commercialisation. EU equivalent: CPVR administered by CPVO. |
| CPVR | Community Plant Variety Right — EU-level plant variety protection administered by CPVO. Grants rights across all EU member states from a single application. |
| UPOV | International Union for the Protection of New Varieties of Plants. NuBred uses UPOV descriptors as the standard for qualifying genotype characteristics. |
| VCU | Value for Cultivation and Use — formal assessment of whether a variety has sufficient agronomic and commercial merit to justify protection. |
| License Agreement | Contract granting a Licensee specific rights over a protected variety in exchange for royalty payments. |
| Exclusive License | A licence where the Licensor grants rights to a single Licensee in a defined territory, committing not to licence to any other party in that territory. |
| Sub-License | A licence granted by a Licensee to a third party, subject to the Licensor's prior written authorisation. |
| Trials Agreement | Contract granting a Cooperator the right to evaluate a variety under strictly defined conditions. No commercial activity, no propagation, no publication without consent. |
| VMC Agreement | Variety Management Company Agreement — the contract under which a Breeder delegates commercial development of a variety to an IVM. |
| Quality Specification | Document defining minimum quality standards fruit must meet to qualify for brand royalty payment. Mandatory before Pilot-to-Launch advancement. |
| Planting Plan | Structured plan defining how many hectares will be planted, by whom, in which locations, and on what timeline. |
| Minimum Quantities | Minimum volume of propagating material or planted hectares a Licensee must achieve to maintain exclusivity or meet contract obligations. |
| Entry Fee | One-time payment made by the Licensee at contract signing as consideration for acquiring exclusive rights. |

---

## 5 · Commercial Terms & Royalties

| Term | NuBred Definition |
|------|-------------------|
| Royalty | Periodic payment by a Licensee or Licensed Grower to the rights holder in exchange for authorised use of a protected variety. |
| PBR Royalty | Royalty based on the plant variety protection right — typically per plant propagated or per hectare planted. |
| Brand Royalty | Royalty based on commercial use of the variety's brand — typically a percentage of the exwork or FOB price per kg of fruit meeting the Quality Specification. |
| Exwork Price | Price of fruit at the point it leaves the producer's facility, before transport costs. Basis for Brand Royalty in many agreements. |
| FOB Price | Free on Board — price of fruit at the point it is loaded onto the transport vessel. Alternative basis for Brand Royalty in international agreements. |
| Production Forecast | Structured estimate of production volume expected from a given planting in a given season. 4-measurement cycle: Fruit Set Count, Growing Stage Diameter, Ripening Stage Weight, Harvest Actual. Mandatory from Pilot onward. |
| Harvest Actual | Definitive production figure declared by the Licensed Grower after harvest. Must be submitted within 30 days of harvest completion. Triggers royalty calculation. |
| Benchmark Variety | Standard commercial variety used as reference for delta EBITDA calculation in the Advanced Protocol. |
| Delta EBITDA | Difference between EBITDA generated by the protected variety and EBITDA that would have been generated by the Benchmark Variety under the same conditions. |
| Pack-out Percentage | Ratio of commercially graded fruit to total harvested weight. Component of Quality Specification compliance and EBITDA calculation. |
| Withholding Tax | Tax deducted at source on royalty payments flowing across borders. |

---

## 6 · Observations & Protocols

Protocols split into **two types** — confusing them creates the wrong data model:
- **Observational Protocol** (Trial, Pilot) — scientific evaluation → Promote/Repeat/Discard + trial report.
- **Commercial Protocol** (Launch, Scale) — production tracking + royalty calculation. Uses F7 4-measurement cycle. Observational parameters reduced to Quality Specification minimums only.

| Term | NuBred Definition |
|------|-------------------|
| Observation | Structured data collection event performed at a defined point in the project lifecycle. Organised by Parameter Family. |
| Parameter Family | One of **eight** fixed families (F1–F8). Families never change; what changes per species and per project is which parameters within each family are active. |
| F1 — Plant Characteristics | Vigour, growth habit, phenology (BBCH scale), trunk/stem diameter, plant health, branching density. |
| F2 — Fruit Quality | Brix, firmness, colour, weight, bloom, juiciness, organoleptic. Primary quality evaluation. |
| F3 — Production | kg/plant or kg/ha, pack-out %, calibre distribution (histogram), commercial vs reject. |
| F4 — Phytosanitary | Pest/disease identification, affectation %, severity scale, cracking, physiological disorders. |
| F5 — Post-Harvest | Storage duration, % damaged/rotten, freshness, bloom retention, weight loss, shelf life. |
| F6 — Climate | Temperature, humidity, wind, radiation, precipitation. Contextual only — no threshold. |
| F7 — Commercial | 4-measurement production forecast cycle, harvest actuals, milestone hectares, royalty flows. Active in Launch and Scale only. |
| F8 — Agronomic Operations | Irrigation (volumes, intervals, water quality), fertilization, pest/disease treatments, pruning, soil management. **Not an observation — an operational log.** Required for GLP-compliant trial reports and the cost side of delta EBITDA. |
| Protocol | Set of parameters, measurement methods, frequencies, and timing windows governing data collection for a specific phase. One Protocol per phase per parameter family category (or group). |
| Threshold | Minimum or target value a parameter must reach. Four types: Quantitative Absolute, Quantitative Relative, UPOV Qualitative, Boolean. |
| Eliminatory Criterion | Threshold whose breach automatically triggers a Discard signal for the genotype. Three levels: L1 Universal (NuBred fixed, no override), L2 Species Standard (VM can raise threshold, never lower), L3 Custom (VM-defined). **A null eliminatory_level means the parameter is NOT eliminatory.** |
| Scale Input Type | Ordinal scale with configurable min and max (NOT hardcoded to 1–5). Polarity (HIGHER_BETTER or LOWER_BETTER) is defined per parameter. |
| Distribution Input Type | A set of percentage values across defined categories that must sum to 100%. Used for calibre distribution and any histogram parameter. Cannot be stored as a single scalar. |
| Frequency Types | Four types: Calendar-fixed (daily/weekly/monthly), Event-based (per harvest event, per BBCH stage), Phase-gate (blocks Promote until completed), On-demand (anomaly/incident). |
| Data Source | Every observation has a source: Manual (Field Observer mobile app), Node (NuBred hardware sensor), or Vision (AI camera). The data schema is identical across all three sources — only the `source` field changes. |
| Weighted Score | Composite performance score calculated from non-eliminatory parameters. Each parameter assigned a weight within a species-and-market profile. |
| BBCH Scale | Standardised numerical scale for plant phenological development stages (00–99). Standard phenology input type (Option list) in NuBred. |
| Brix | Sugar content of fruit juice as a percentage of dissolved solids. Measured with refractometer. Primary quality parameter and key Eliminatory Criterion for most fruit species. For kiwi, measured at consumption readiness (after 2–3 weeks ripening), not at harvest. |
| Dry Matter % (DM) | Primary harvest gate parameter for kiwi — determines storability. Minimum DM varies by market (NZ: 6.2%, EU: 6.5%). More important than Brix for kiwi. |
| PSA (Pseudomonas syringae pv. actinidiae) | Bacterial pathogen devastating to yellow kiwi (Actinidia chinensis). **L1 eliminatory for yellow kiwi — any confirmed PSA infection = immediate Discard signal, no VM override possible.** |
| VCU Assessment | Formal evaluation of a variety's Value for Cultivation and Use — conducted during Trial phase. Results owned exclusively by the Breeder. |
| Post-Harvest Evaluation | Observation on stored fruit after harvest assessing storage duration, disease development, weight loss, and physical defects. Kiwi: evaluated at 4, 8, 12, 16 weeks in cold storage. Other fruit: typically at 15 and 30 days post-harvest. |

---

## 7 · Phytosanitary & Quarantine

| Term | NuBred Definition |
|------|-------------------|
| Quarantine | Legally mandated period during which imported plant material is isolated and inspected before release. NuBred tracks status, expected certification dates, and compliance documentation. |
| Phytosanitary Certificate | Official document certifying that plant material meets importing country's phytosanitary requirements. Required for international movement of propagating material. |
| Cracking | Physiological disorder in fruit where skin splits due to rapid water absorption. Exceeding 30% of sampled fruit is an L2 Eliminatory Criterion for cherry. |
| Monilia | Monilinia spp. — fungal pathogen causing brown rot in stone fruits. Affectation above 20% at harvest triggers a Discard signal (L2 for cherry). |
| PSA | Pseudomonas syringae pv. actinidiae — bacterial pathogen affecting kiwifruit. **L1 Eliminatory for yellow kiwi (Actinidia chinensis) — confirmed infection = immediate Discard, no VM override.** Monitored as a phytosanitary parameter in kiwi protocols. |
| Botrytis cinerea | Fungal pathogen causing grey mould. L2 eliminatory for kiwi — >10% affected fruit at harvest triggers commercial rejection risk. |

---

## 8 · AI & System Terms

| Term | NuBred Definition |
|------|-------------------|
| NuBred Analysis Engine | AI-powered component that reads uploaded documents and generates the structured project representation. Claude API for contract analysis and deep reasoning; Gemini API for lighter tasks. |
| Project Representation | Structured output generated after processing uploaded documents. Includes Actor Diagram, Phase Timeline, Clause Analysis, and To-Do List. Draft until confirmed by the VM. |
| Source Citation | Reference attached to every AI conclusion — document name, relevant passage, NuBred framework element. Every conclusion must be verifiable. |
| Draft Project | A project analysed by AI but not yet confirmed by the VM. Not visible to invited actors. VM can edit before confirming. |
| Confidence Level | Every extracted field has one of three levels: Confirmed (from signed document or definitive source), Provisional (from non-binding source), Conflicting (two documents disagree). |
