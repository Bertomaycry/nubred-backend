import { z } from "zod";
import { evidenceArraySchema } from "../_shared/evidence.schema.js";

// ---------------------------------------------------------------------------
// Reference enumerations — derived from ContractExtractionGuide sections 1.1
// and Part 2. These are the only valid values; null means not found in the doc.
// ---------------------------------------------------------------------------

export const CONTRACT_FAMILIES = [
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8",
  "F9", "F10", "F11", "F12", "F13", "F14", "F15",
  "F16", "F17", "F18", "F19", "F20", "F21", "F22",
  "F23", "F24",
  "UNCLASSIFIED", // use when no family matches; explain in flags
];

export const ECONOMIC_FUNCTIONS = [
  "MF-1", // Propagation
  "MF-2", // Evaluation (VCU trials)
  "MF-3", // VMC Development (delegated commercial development)
  "MF-4", // Fruit Distribution
  "MF-5", // Terminal Licence (end-point commercial)
  "MF-6", // Territory Positioning
  "MF-7", // Germplasm (co-breeding / exchange)
  "MF-8", // Operational Support (consulting, management)
];

export const NUBRED_PARTY_ROLES = [
  "BREEDER",
  "PRINCIPAL",        // same entity as Breeder in some contract families
  "LICENSOR",
  "IVM",              // Independent Variety Manager
  "LICENSEE",
  "NURSERY",
  "LICENSED_GROWER",
  "PACKHOUSE",
  "MARKETER",
  "CONSULTANT",
  "LPM",              // Licence Portfolio Manager
  "CONTRACTOR",
  "ASSOCIATION_OF_PRODUCERS",
  "UNKNOWN",          // role present but cannot be determined — flag for VM review
];

export const PBR_STATUSES = [
  "PROTECTED",            // grant number and office known
  "APPLICATION_PENDING",  // filing date known, not yet granted
  "NOT_YET_FILED",
  "UNKNOWN",
];

export const FLAG_SEVERITIES = ["HIGH", "MEDIUM", "LOW"];
export const FLAG_TYPES = ["ABSENCE", "ANOMALY", "IMBALANCE"];

// ---------------------------------------------------------------------------
// Sub-schemas — correspond 1-to-1 with Part 4 of the extraction guide
// ---------------------------------------------------------------------------

const partySchema = z.object({
  name: z
    .string()
    .nullable()
    .describe(
      "Full legal name including legal form (soc. cons. a r.l., Ltd, GmbH, etc.). " +
        "Source: contract preamble and signature block. " +
        "Example: 'C.I.V. Consorzio Italiano Vivaisti soc. cons. a r.l.'"
    ),
  role: z
    .enum(NUBRED_PARTY_ROLES)
    .nullable()
    .describe(
      "NuBred Glossary role assigned from the contract text. " +
        "Use the role the party plays in THIS contract — a nursery acting as licensor in one contract " +
        "is still LICENSOR in that contract. " +
        "Use UNKNOWN only when the role genuinely cannot be determined; this triggers a flag."
    ),
  country: z
    .string()
    .nullable()
    .describe(
      "Country of registration taken from the registered office address in the preamble. " +
        "ISO country name (e.g. 'Italy', 'Israel', 'Poland')."
    ),
});

const varietySchema = z.object({
  name: z
    .string()
    .nullable()
    .describe(
      "Variety or selection name as stated in the contract — commercial name and/or breeder code. " +
        "If varieties are listed in an Annex rather than inline, set this to the Annex reference " +
        "and the count: 'See Annex 1 — 3 varieties listed'."
    ),
  code: z
    .string()
    .nullable()
    .describe(
      "Internal breeder code if distinct from the commercial name. " +
        "Example: 'CVRI-08' alongside commercial name 'Smeralda'."
    ),
  pbr_status: z
    .enum(PBR_STATUSES)
    .nullable()
    .describe(
      "Protection status. PROTECTED requires grant number + office. " +
        "Source: typically Annex 1 or 2 of the contract, or the IP schedule."
    ),
  pbr_office: z
    .string()
    .nullable()
    .describe("Granting office name. Example: 'CPVO', 'USPP', 'JDPB'."),
  pbr_number: z
    .string()
    .nullable()
    .describe(
      "Grant number or application number. Example: 'CPVO 44847'. " +
        "If only an application is pending, use the filing reference number."
    ),
});

const trademarkSchema = z.object({
  name: z
    .string()
    .nullable()
    .describe("Trademark name as registered or applied for. Example: 'Dorì'."),
  registration: z
    .string()
    .nullable()
    .describe(
      "Registration number or status. Example: 'EUIPO application pending', 'EUIPO 018012345'."
    ),
  territory: z
    .string()
    .nullable()
    .describe("Territory of TM registration. Example: 'European Union', 'Italy'."),
  included_in_contract: z
    .boolean()
    .nullable()
    .describe(
      "True if the TM licence is contained within this contract. " +
        "False if the TM licence is in a separate document referenced here."
    ),
});

const territoriesSchema = z.object({
  production: z
    .string()
    .nullable()
    .describe(
      "Geographic territory where propagation or production activities are authorised. " +
        "Exact country/region as stated in the contract or Annex."
    ),
  commercialisation: z
    .string()
    .nullable()
    .describe(
      "Geographic territory where fruit or plants may be commercialised. " +
        "Example: 'European Union + Middle East'."
    ),
  exclusivity_regime: z
    .string()
    .nullable()
    .describe(
      "Exclusivity status of each right. For each right granted, state whether it is " +
        "exclusive or non-exclusive. If exclusivity is conditional (e.g. subject to Minimum Quantities), " +
        "state the condition. " +
        "Example: 'Propagation: non-exclusive. Commercialisation: exclusive, subject to Minimum Quantities.'"
    ),
});

const rightGrantedSchema = z.object({
  right_type: z
    .string()
    .nullable()
    .describe(
      "Type of right: 'PROPAGATION', 'CULTIVATION', 'COMMERCIALISATION', 'TRADEMARK_USE', " +
        "'SALE_AND_DELIVERY', 'VCU_EVALUATION', 'CO_BREEDING', or a plain-language description for non-standard rights."
    ),
  exclusive: z
    .boolean()
    .nullable()
    .describe("True if exclusive in the stated territory, false if non-exclusive, null if not specified."),
  territory: z
    .string()
    .nullable()
    .describe("Territory where this specific right applies."),
  conditions: z
    .string()
    .nullable()
    .describe(
      "Any conditions attached to this right — e.g. must exercise through Authorised Nursery only, " +
        "subject to minimum quantities, co-branding approval required."
    ),
});

const minimumQuantitiesSchema = z.object({
  per_season: z
    .string()
    .nullable()
    .describe(
      "Minimum quantities per season. Include unit (plants, hectares, kg). " +
        "If quantities vary by year, describe the ramp: 'Year 1: 10,000 plants. Year 2: 25,000 plants. Year 3+: 50,000 plants.'"
    ),
  tolerance_pct: z
    .number()
    .nullable()
    .describe("Tolerance percentage below minimum (negative number). Example: -15 means 15% shortfall allowed."),
  recovery_years: z
    .number()
    .int()
    .nullable()
    .describe("Number of consecutive seasons the licensee has to recover before enforcement escalates."),
  enforcement: z
    .string()
    .nullable()
    .describe(
      "Consequence of non-compliance in plain language. " +
        "Example: 'Step 1: lump-sum indemnity per Annex 6. Step 2 (if repeated): revocation of exclusivity. Step 3 (if persisted): termination.'"
    ),
});

const financialTermsSchema = z.object({
  entry_fee: z
    .string()
    .nullable()
    .describe(
      "Amount, currency, payment due date, and refundability conditions. " +
        "State explicitly if no entry fee exists. " +
        "Example: '€200,000 — payable within 30 days of signing. Partially refundable if CPVO PBR rejected.'"
    ),
  royalty_structure: z
    .string()
    .nullable()
    .describe(
      "How royalty is calculated. State basis: per plant / per kg / per hectare / flat annual / embedded in plant price. " +
        "Include rate. State whether royalty is included in plant price or invoiced separately. " +
        "Example: 'Royalty embedded in Finished Plant price. €28 per 1,000 plants.'"
    ),
  payment_calendar: z
    .string()
    .nullable()
    .describe(
      "All financial reporting deadlines and payment dates. " +
        "Example: 'Commercialisation report: 15 January each year. Royalty payment: 28 February. Late payment: 5% annual interest.'"
    ),
});

const optionRightsSchema = z.object({
  optioned_varieties: z
    .array(z.string())
    .nullable()
    .describe(
      "List of variety names or codes that carry an Option Right (as opposed to only a Right of Exclusive Negotiation). " +
        "Distinguish clearly from varieties that only carry ROFR."
    ),
  mlc_terms: z
    .string()
    .nullable()
    .describe(
      "Pre-agreed Minimum Licensing Conditions from the relevant Annex. " +
        "Include at minimum: royalty rate, exclusivity, territory, minimum quantities."
    ),
  exercise_window: z
    .string()
    .nullable()
    .describe(
      "How long the IVM/licensee has to exercise the Option, from what trigger date, " +
        "and what happens on non-exercise. " +
        "Example: '60 days from end of Evaluation Period. Non-exercise = irrevocable waiver of cost reimbursement claims.'"
    ),
  rofr: z
    .string()
    .nullable()
    .describe(
      "Right of First Refusal details: if Breeder licences a variety not selected by IVM to a third party, " +
        "does IVM receive cost reimbursement? Extract the specific article and conditions."
    ),
});

const reportingObligationSchema = z.object({
  report_type: z
    .string()
    .describe(
      "Name of the report as described in the contract. " +
        "Examples: 'Mother plant census', 'VCU annual report', 'Harvest declaration', 'Commercialisation report'."
    ),
  deadline: z
    .string()
    .nullable()
    .describe(
      "Due date or deadline trigger. Use contract language: '31 March each year', " +
        "'within 30 days of harvest completion', '15 January for the preceding season'."
    ),
  content_summary: z
    .string()
    .nullable()
    .describe("Brief description of what the report must contain."),
});

const terminationTriggerSchema = z.object({
  event: z
    .string()
    .describe(
      "Specific event that triggers termination. Be precise: cite the contractual obligation that, if breached, allows termination. " +
        "Example: 'Non-payment of royalties for more than 30 days', " +
        "'Failure to meet Minimum Quantities for 2 consecutive seasons', 'Unauthorised propagation'."
    ),
  type: z
    .enum(["EXPRESS", "ORDINARY"])
    .describe(
      "EXPRESS: immediate termination without prior notice (art. 1456 Italian civil code equivalent). " +
        "ORDINARY: termination requires notice period."
    ),
  notice_days: z
    .number()
    .int()
    .nullable()
    .describe(
      "Notice period in calendar days for ORDINARY termination. Null for EXPRESS termination."
    ),
});

const penaltySchema = z.object({
  event: z
    .string()
    .describe(
      "Triggering event for the penalty. Example: 'Purchasing plants from unauthorised source', " +
        "'False census declaration', 'Failure to meet Minimum Quantities'."
    ),
  amount: z
    .string()
    .nullable()
    .describe(
      "Penalty amount. Use contract currency and unit. " +
        "Example: '€5.00', '10x declared royalties', 'lump-sum per Annex 6 formula'."
    ),
  unit: z
    .string()
    .nullable()
    .describe("Unit the amount applies to. Example: 'per plant', 'per kg of fruit', 'per ha', 'flat sum'."),
  payer: z
    .string()
    .nullable()
    .describe("Party who pays the penalty (use the NuBred role from parties[])."),
  payee: z
    .string()
    .nullable()
    .describe("Party who receives the penalty payment."),
});

const survivingObligationSchema = z.object({
  obligation: z
    .string()
    .describe(
      "The obligation that survives contract termination. " +
        "Examples: 'Confidentiality', 'EDV notification', 'Non-compete', 'Plant destruction', 'IP non-challenge'."
    ),
  duration: z
    .string()
    .nullable()
    .describe(
      "How long the obligation survives. Use contract language: 'indefinitely', '1 year post-termination', " +
        "'20 years post-termination for VCU data', '30 days for plant destruction'."
    ),
  notes: z
    .string()
    .nullable()
    .describe(
      "Any qualifying conditions or scope limitations. " +
        "Example: 'Covers all Confidential Information including VCU data. " +
        "Breeding limitations apply only to NPV-derived varieties.'"
    ),
});

const edvClauseSchema = z.object({
  present: z
    .boolean()
    .describe("True if an EDV clause exists in the contract, false if explicitly absent."),
  ownership_rule: z
    .string()
    .nullable()
    .describe(
      "One-sentence summary of the EDV ownership rule. " +
        "Example: 'EDVs discovered by Contractor belong exclusively to CIV. " +
        "Immediate notification and tissue sample submission required.'"
    ),
  notification_required: z
    .boolean()
    .nullable()
    .describe("True if the discovering party must notify the IP holder upon EDV discovery."),
});

const disputeResolutionSchema = z.object({
  law: z
    .string()
    .nullable()
    .describe(
      "Applicable law. If bilingual contract, note which language version prevails in case of discrepancy. " +
        "Example: 'Italian law. Italian text prevails over English translation.'"
    ),
  forum: z
    .string()
    .nullable()
    .describe(
      "Competent court or arbitration body. Note any unilateral right to derogate from the agreed forum. " +
        "Example: 'Court of Bologna. CIV may unilaterally derogate and bring proceedings before any other competent court.'"
    ),
  arbitration: z
    .boolean()
    .nullable()
    .describe("True if arbitration is chosen instead of court litigation."),
  arbitration_details: z
    .string()
    .nullable()
    .describe(
      "If arbitration: rules, seat, language, number of arbitrators, standard of decision. " +
        "Example: 'ICC Arbitration Rules. Seat: Slovakia. Language: Slovak. 3 arbitrators. Decision in conformity to law.'"
    ),
});

const flagSchema = z.object({
  clause_id: z
    .string()
    .describe(
      "AgreeLyze clause ID from the library (C-01 through C-45), or a plain identifier for project-specific clauses."
    ),
  severity: z
    .enum(FLAG_SEVERITIES)
    .describe("HIGH: material enforceability or governance risk. MEDIUM: best-practice gap. LOW: cosmetic."),
  type: z
    .enum(FLAG_TYPES)
    .describe(
      "ABSENCE: standard clause category entirely missing. " +
        "ANOMALY: clause present but materially deviates from market standard. " +
        "IMBALANCE: clause present but creates significant power asymmetry — identify which party bears the disadvantage."
    ),
  note: z
    .string()
    .describe(
      "Explanation of the finding. For ABSENCE: what is missing and why it matters. " +
        "For ANOMALY: how it deviates from market standard. " +
        "For IMBALANCE: which party is disadvantaged and how."
    ),
});

// ---------------------------------------------------------------------------
// Root extraction schema — this is what the LLM must return for the Contract section
// ---------------------------------------------------------------------------

export const contractExtractionSchema = z.object({
  // --- Part 1: Contract Identity ---
  contract_type: z
    .enum(CONTRACT_FAMILIES)
    .nullable()
    .describe(
      "Contract family code F1–F24 (or UNCLASSIFIED). " +
        "Determine from the WHEREAS clauses and the object article: " +
        "what economic function does this contract perform, who collects royalties, who bears commercial risk? " +
        "Classify before applying any type-specific extraction."
    ),
  economic_function: z
    .enum(ECONOMIC_FUNCTIONS)
    .nullable()
    .describe(
      "Macro-function code. MF-1 Propagation / MF-2 Evaluation / MF-3 VMC Development / " +
        "MF-4 Fruit Distribution / MF-5 Terminal Licence / MF-6 Territory Positioning / " +
        "MF-7 Germplasm / MF-8 Operational Support."
    ),
  confidence_score: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Classification confidence 0.0–1.0. Reflect genuine uncertainty. " +
        "Do not inflate. A confidence of 1.0 means the contract type is unambiguous."
    ),
  contract_language: z
    .string()
    .nullable()
    .describe(
      "Language(s) of the document. If bilingual, list both and state which version prevails. " +
        "Example: 'Bilingual: Italian + English. Italian text prevails.'"
    ),
  governing_law: z
    .string()
    .nullable()
    .describe("Applicable law as stated in the Governing Law and Jurisdiction clause."),
  effective_date: z
    .string()
    .nullable()
    .describe("Date of effect or signature in ISO 8601 format (YYYY-MM-DD)."),
  end_date: z
    .string()
    .nullable()
    .describe(
      "Fixed expiry date in ISO 8601, or a plain-language trigger description if indefinite or linked to PBR expiry. " +
        "Example: 'Until expiry of CPVO PBR in EU territory (expected 31/12/2056)'. " +
        "Null if the contract has no end date and no trigger."
    ),
  evaluation_period: z
    .string()
    .nullable()
    .describe(
      "Duration of the Evaluation / Trial period and its start trigger. " +
        "Present only in IVM / evaluation agreement types. " +
        "Example: '4 growing seasons from Release Date'."
    ),
  renewal_mechanism: z
    .string()
    .nullable()
    .describe(
      "Whether automatic renewal applies, the notice period required to prevent renewal, " +
        "and who has the right to not renew. Null if no renewal clause exists."
    ),

  // --- Part 1: Parties ---
  parties: z
    .array(partySchema)
    .describe(
      "All parties to the contract, including additional parties such as AoPs or joint institutes. " +
        "Extract from preamble and signature block. Always include every named party."
    ),

  // --- Part 1: Varieties and IP ---
  varieties: z
    .array(varietySchema)
    .describe(
      "All variety or selection names mentioned in the contract, including annexes. " +
        "Do not deduplicate — if a variety appears in both the body and an annex, include once with the fuller data."
    ),
  trademark: trademarkSchema
    .nullable()
    .describe(
      "Trademark licensed under this contract. Null if no trademark is referenced."
    ),
  edv_clause: edvClauseSchema
    .nullable()
    .describe(
      "Essentially Derived Variety clause analysis. " +
        "Null only if the clause is entirely absent — in that case, add an ABSENCE flag in `flags` " +
        "(severity HIGH for co-breeding and development agreements)."
    ),

  // --- Part 1: Territories ---
  territories: territoriesSchema.describe(
    "Geographic territories where each right applies."
  ),

  // --- Part 1: Term and Duration (already included above) ---

  // --- Part 2: Rights Bundle ---
  rights_granted: z
    .array(rightGrantedSchema)
    .describe(
      "All rights granted: propagation, cultivation, commercialisation, TM use, etc. " +
        "One entry per right type per territory. Include conditions attached to each right."
    ),

  // --- Part 2: Financial ---
  minimum_quantities: minimumQuantitiesSchema
    .nullable()
    .describe(
      "Minimum Quantities clause details. " +
        "Null if not present — but add an ABSENCE flag (HIGH) for commercial licence contracts."
    ),
  financial_terms: financialTermsSchema.describe(
    "Entry fee, royalty structure, and payment calendar."
  ),
  option_rights: optionRightsSchema
    .nullable()
    .describe(
      "Option rights and preferential rights. " +
        "Null if not present in this contract type."
    ),

  // --- Part 2: Obligations ---
  reporting_obligations: z
    .array(reportingObligationSchema)
    .describe(
      "All reports each party must submit, with content description and deadline. " +
        "Include reports for all parties, not just the primary licensee."
    ),

  // --- Part 3: Survival and Risk ---
  termination_triggers: z
    .array(terminationTriggerSchema)
    .describe(
      "All termination triggers, classified as EXPRESS (immediate) or ORDINARY (with notice period). " +
        "List every event that gives either party a termination right."
    ),
  penalties: z
    .array(penaltySchema)
    .describe(
      "All contractual penalties. Distinguish between lump-sum indemnity for Minimum Quantities failure " +
        "and per-unit penalties for specific obligation breaches."
    ),
  surviving_obligations: z
    .array(survivingObligationSchema)
    .describe(
      "All obligations that survive contract termination: confidentiality, IP ownership, non-compete, " +
        "breeding limitations, plant destruction timeline."
    ),
  dispute_resolution: disputeResolutionSchema.describe(
    "Applicable law, competent court or arbitration body, and arbitration details if applicable."
  ),

  // --- Flags: gap analysis across all clause categories ---
  flags: z
    .array(flagSchema)
    .describe(
      "All ABSENCE, ANOMALY, and IMBALANCE findings from clause analysis. " +
        "Every absent standard clause (C-01 through C-45) must appear here with severity HIGH or MEDIUM. " +
        "Produce flags even when no risk is found (use LOW severity) to confirm the clause was checked. " +
        "Do not omit a finding because you are unsure — flag it with an explanation."
    ),

  // --- Evidence: one entry per extracted value ---
  evidence: evidenceArraySchema,
});

/** Convenience type export for JSDoc usage elsewhere */
export const ContractExtraction = contractExtractionSchema;
