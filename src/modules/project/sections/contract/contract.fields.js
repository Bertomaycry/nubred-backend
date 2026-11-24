import { field, group } from "../field-tree/index.js";
import { CONTRACT_TYPES, LANGUAGES } from "../_shared/field-helpers.js";

const headerFields = [
  field({ key: "contract_title", label: "Contract title", type: "string", uiGroup: "header" }),
  field({
    key: "contract_type",
    label: "Contract type",
    type: "option",
    options: CONTRACT_TYPES,
    uiGroup: "header",
  }),
  field({
    key: "other_type_description",
    label: "Other type: description",
    type: "string",
    showIf: { field: "contract_type", equals: "Other" },
    uiGroup: "header",
  }),
  field({
    key: "signature_status",
    label: "Signature status",
    type: "option",
    options: ["Signed", "Partially signed", "Unsigned"],
    uiGroup: "header",
  }),
  field({
    key: "languages",
    label: "Languages",
    type: "option_multi",
    options: LANGUAGES,
    uiGroup: "header",
  }),
];

const partiesGroup = group({
  key: "parties",
  label: "Parties",
  repeatable: true,
  identity: ["name_as_written"],
  children: [
    field({ key: "name_as_written", label: "Name as written", type: "string" }),
    field({ key: "company", label: "Company", type: "ref", ref: { section: "supply_chain", group: "company" } }),
    field({
      key: "role_in_this_contract",
      label: "Role in this contract",
      type: "option_multi",
      options: [
        "Breeder",
        "Principal",
        "Licensor",
        "IVM",
        "Licensee",
        "Nursery",
        "Grower",
        "Distributor / Marketer",
        "Association of Producers",
        "Consultant",
        "LPM",
        "Contractor",
        "Other",
      ],
    }),
    field({ key: "defined_term", label: "Defined term in contract", type: "string" }),
    field({ key: "acting_on_behalf_of", label: "Acting on behalf of", type: "ref", ref: { section: "contract", group: "parties" } }),
    field({ key: "signatory", label: "Signatory", type: "string", combo: "signatory" }),
    field({ key: "signatory_title", label: "Signatory title", type: "string", combo: "signatory" }),
    field({ key: "signed", label: "Signed", type: "boolean" }),
    field({
      key: "signature_date",
      label: "Signature date",
      type: "date",
      showIf: { field: "signed", equals: "true" },
    }),
  ],
});

const subjectGroup = group({
  key: "subject",
  label: "Subject",
  children: [
    field({ key: "varieties_covered", label: "Varieties covered", type: "ref_multi", ref: { section: "genotype" } }),
    field({ key: "trademarks_licensed", label: "Trademarks licensed", type: "ref_multi", ref: { section: "ip_right" } }),
    field({
      key: "material_supplied",
      label: "Material and know-how supplied",
      type: "option_multi",
      options: [
        "Propagating material",
        "Mother plants",
        "Finished plants",
        "Technical information / know-how",
        "Data and results",
        "Other",
      ],
    }),
  ],
});

const termGroup = group({
  key: "term",
  label: "Term",
  children: [
    field({ key: "effective_date", label: "Effective date", type: "date" }),
    field({
      key: "end_rule",
      label: "End rule",
      type: "option",
      options: ["Fixed date", "Until PBR expiry", "Indefinite", "Other"],
    }),
    field({
      key: "end_date",
      label: "End date",
      type: "date",
      showIf: { field: "end_rule", in: ["Fixed date", "Until PBR expiry"] },
    }),
    field({ key: "renewal", label: "Renewal", type: "option", options: ["None", "Automatic", "By agreement"] }),
    field({
      key: "renewal_notice_days",
      label: "Renewal notice (days)",
      type: "int",
      showIf: { field: "renewal", equals: "Automatic" },
    }),
    field({ key: "conditions_precedent", label: "Conditions precedent", type: "list" }),
  ],
});

const rightsGroup = group({
  key: "rights_granted",
  label: "Rights granted",
  repeatable: true,
  identity: ["right_type", "grantor", "grantee"],
  children: [
    field({
      key: "right_type",
      label: "Right type",
      type: "option",
      options: [
        "Propagation",
        "Cultivation",
        "Sale of plants",
        "Commercialisation of fruit",
        "TM use",
        "Trial and evaluation",
        "Breeding",
        "Club project",
        "Service",
        "Other",
      ],
    }),
    field({ key: "grantor", label: "Grantor", type: "ref", ref: { section: "contract", group: "parties" } }),
    field({ key: "grantee", label: "Grantee", type: "ref", ref: { section: "contract", group: "parties" } }),
    field({ key: "right_status", label: "Status", type: "option", options: ["Granted", "Option", "Future"] }),
    field({ key: "exclusivity", label: "Exclusivity", type: "option", options: ["Exclusive", "Non-exclusive", "Conditional"] }),
    field({ key: "exclusivity_condition", label: "Exclusivity condition", type: "text", showIf: { field: "exclusivity", equals: "Conditional" } }),
    field({ key: "territory_as_written", label: "Territory (as written)", type: "string", combo: "territory" }),
    field({ key: "countries", label: "Countries", type: "option_multi", options: ["ISO3166"], combo: "territory" }),
    field({ key: "limits", label: "Limits", type: "text" }),
    field({ key: "sublicensable", label: "Sublicensable", type: "option", options: ["No", "With approval", "Yes"] }),
  ],
});

const optionGroup = group({
  key: "option_rights",
  label: "Option and preferential rights",
  repeatable: true,
  contractTypes: ["A", "B"],
  identity: ["kind", "holder"],
  children: [
    field({ key: "kind", label: "Kind", type: "option", options: ["Option", "Exclusive negotiation", "ROFR", "Other"] }),
    field({ key: "holder", label: "Holder", type: "ref", ref: { section: "contract", group: "parties" } }),
    field({ key: "applies_to_varieties", label: "Applies to varieties", type: "ref_multi", ref: { section: "genotype" } }),
    field({ key: "start_trigger", label: "Start trigger", type: "string", combo: "window" }),
    field({ key: "window_length_days", label: "Window length (days)", type: "int", combo: "window" }),
    field({ key: "terms_agreed", label: "Terms agreed in advance", type: "text" }),
    field({ key: "consequence_if_not_exercised", label: "Consequence if not exercised", type: "text" }),
    field({ key: "cost_reimbursement_rule", label: "Cost reimbursement rule", type: "text" }),
  ],
});

const disputeGroup = group({
  key: "dispute_resolution",
  label: "Dispute resolution",
  children: [
    field({ key: "governing_law", label: "Governing law", type: "string" }),
    field({ key: "forum_type", label: "Forum type", type: "option", options: ["Court", "Arbitration"], combo: "forum" }),
    field({ key: "court_or_arbitration_body", label: "Court or arbitration body", type: "string", combo: "forum" }),
    field({ key: "arbitration_details", label: "Arbitration details", type: "text", showIf: { field: "forum_type", equals: "Arbitration" }, combo: "forum" }),
    field({ key: "unilateral_derogation_right", label: "Unilateral derogation right", type: "text" }),
    field({ key: "prevailing_language", label: "Prevailing language", type: "option", options: LANGUAGES }),
  ],
});

const paymentsGroup = group({
  key: "payments",
  label: "Payments",
  repeatable: true,
  identity: ["kind", "payer", "payee"],
  children: [
    field({
      key: "kind",
      label: "Kind",
      type: "option",
      options: [
        "Entry fee",
        "Option fee",
        "Royalty",
        "Plant price",
        "Service fee",
        "Revenue share",
        "Cost reimbursement",
        "Other",
      ],
    }),
    field({ key: "payer", label: "Payer", type: "ref", ref: { section: "contract", group: "parties" } }),
    field({ key: "payee", label: "Payee", type: "ref", ref: { section: "contract", group: "parties" } }),
    field({
      key: "rate_basis",
      label: "Basis",
      type: "option",
      options: ["Flat", "Per plant", "Per kg", "Per ha", "% of royalties", "% of net", "Embedded in price", "Other"],
      combo: "rate",
    }),
    field({ key: "rate_amount", label: "Amount", type: "decimal", combo: "rate" }),
    field({ key: "rate_currency", label: "Currency", type: "string", combo: "rate" }),
    field({ key: "rate_percentage", label: "Percentage", type: "decimal", combo: "rate" }),
    field({ key: "applies_to_varieties", label: "Applies to varieties", type: "ref_multi", ref: { section: "genotype" } }),
    field({ key: "timing", label: "Timing", type: "string" }),
    field({ key: "conditions", label: "Conditions", type: "text" }),
    field({ key: "late_payment", label: "Late payment", type: "string" }),
    field({ key: "tax_clause", label: "Tax clause", type: "text" }),
  ],
});

const obligationsGroup = group({
  key: "obligations",
  label: "Obligations",
  repeatable: true,
  identity: ["responsible_party", "category", "description"],
  children: [
    field({ key: "responsible_party", label: "Responsible party", type: "ref", ref: { section: "contract", group: "parties" } }),
    field({ key: "towards", label: "Towards", type: "ref", ref: { section: "contract", group: "parties" } }),
    field({
      key: "category",
      label: "Category",
      type: "option",
      options: ["Service", "Report", "Notification", "Approval", "Supply", "Quality", "Access and inspection", "Insurance", "Other"],
    }),
    field({ key: "description", label: "Description", type: "text" }),
    field({ key: "trigger", label: "Trigger", type: "string", combo: "timing" }),
    field({ key: "deadline_or_frequency", label: "Deadline or frequency", type: "string", combo: "timing" }),
    field({ key: "consequence_if_missed", label: "Consequence if missed", type: "text" }),
  ],
});

const reviewFlagsGroup = group({
  key: "review_flags",
  label: "Review flags",
  repeatable: true,
  identity: ["clause_topic"],
  children: [
    field({ key: "clause_topic", label: "Clause topic", type: "string" }),
    field({ key: "flag_type", label: "Flag type", type: "option", options: ["Absent", "Anomaly", "Imbalance"] }),
    field({ key: "severity", label: "Severity", type: "option", options: ["High", "Medium", "Low"] }),
    field({ key: "note", label: "Note", type: "text" }),
  ],
});

/** @type {import("../field-tree/types.js").SectionFieldTree} */
export const contractFieldTree = {
  sectionKey: "contract",
  contextFields: [],
  children: [
    ...headerFields,
    partiesGroup,
    subjectGroup,
    termGroup,
    rightsGroup,
    optionGroup,
    disputeGroup,
    paymentsGroup,
    obligationsGroup,
    reviewFlagsGroup,
  ],
  extractionParts: [
    {
      key: "header_parties_subject_term",
      label: "Header, parties, subject, term",
      nodes: [...headerFields, partiesGroup, subjectGroup, termGroup],
    },
    {
      key: "rights_options",
      label: "Rights and options",
      nodes: [rightsGroup, optionGroup, disputeGroup],
    },
    {
      key: "payments_obligations_flags",
      label: "Payments, obligations, flags",
      nodes: [paymentsGroup, obligationsGroup, reviewFlagsGroup],
    },
  ],
};