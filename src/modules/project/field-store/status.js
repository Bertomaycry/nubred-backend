/** Map LLM status strings to Prisma enums. */
export function toFieldValueStatus(status) {
  switch (status) {
    case "found":
      return "FOUND";
    case "not_applicable":
      return "NOT_APPLICABLE";
    default:
      return "NOT_FOUND";
  }
}

export function toPrismaConfidence(level) {
  if (level === "CONFIRMED" || level === "PROVISIONAL" || level === "CONFLICTING") {
    return level;
  }
  return "PROVISIONAL";
}

export function badgeForField(row, openCandidates) {
  if (row?.derive) return "READ_ONLY";
  const status = row?.status;
  const review = row?.review;
  if (review === "GAP") return "MISSING";
  if ((openCandidates ?? 0) > 1) return "CONFLICT";
  if (status === "NOT_FOUND" || row?.value == null) return "MISSING";
  if (row?.confidence === "CONFIRMED") return "VALID";
  if (row?.confidence === "CONFLICTING") return "CONFLICT";
  return "PROVISIONAL";
}