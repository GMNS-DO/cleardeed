/**
 * User-prompt builder for A12. Plan §3.1: 4-block content array, with
 * cache_control on system + context for prompt caching.
 */

import type { DocType, DocumentInput } from "../schema";

export type ContentBlock =
  | { type: "text"; text: string; cache_control?: { type: "ephemeral" } }
  | { type: "document"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

const SCHEMA_HINT_IGR_EC = `Schema fields (one entry per EC row, plus document-level fields):
- "sro" (string): sub-registrar office name
- "encumbranceType" (string): one of "mortgage", "sale", "lease", "gift", "partition", "release", "other"
- "partyName" (string): the registered party
- "docNo" (string): document/deed number
- "date" (string): execution date in DD/MM/YYYY
- "amount" (string): consideration or mortgage amount in INR (with commas)`;

const SCHEMA_HINT_BHULEKH_BACK = `Schema fields:
- "mutationNumber" (string): the mutation entry number
- "mutationDate" (string): the date the mutation was recorded
- "fromKhatiyan" (string): previous khata number
- "toKhatiyan" (string): new khata number
- "courtCaseRef" (string): any DR case number or reservation case reference
- "plotNo" (string): the plot being mutated`;

export function buildUserBlocks(input: DocumentInput, docType: DocType): ContentBlock[] {
  const schemaHint =
    docType === "igr_ec" ? SCHEMA_HINT_IGR_EC : SCHEMA_HINT_BHULEKH_BACK;
  const docTypeLabel = docType === "igr_ec" ? "IGR Encumbrance Certificate" : "Bhulekh back page";

  const blocks: ContentBlock[] = [
    {
      type: "text",
      text: `Document type: ${docTypeLabel}\n\n${schemaHint}\n\nReturn JSON only. No prose.`,
      cache_control: { type: "ephemeral" },
    },
  ];

  switch (input.kind) {
    case "html":
      blocks.push({
        type: "text",
        text: `Document content (HTML):\n\n${input.content}`,
      });
      break;
    case "pdfBase64":
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: input.content },
      });
      break;
    case "pngBase64":
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: "image/png", data: input.content },
      });
      break;
  }

  return blocks;
}
