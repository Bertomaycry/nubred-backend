import { z } from "zod";
import { READING_ORDER } from "../sections/field-tree/types.js";

export const triageSchema = z.object({
  detectedType: z.string().nullable(),
  documentDate: z.string().nullable(),
  signed: z.boolean().nullable(),
  relatedContractRecordId: z.string().uuid().nullable(),
  relevantSections: z
    .array(z.string())
    .default([])
    .transform((arr) => arr.filter((k) => READING_ORDER.includes(k))),
});