import { createHash } from "node:crypto";

const HEADINGS = [
  "study purpose", "purpose", "study procedures", "procedures", "what will happen",
  "risks and discomforts", "risks", "possible risks", "benefits", "alternatives",
  "other treatment", "voluntary participation", "right to withdraw", "withdrawal",
  "confidentiality", "privacy", "costs", "payment", "compensation", "new findings",
  "injury", "contacts",
];
const HEADING_ALIASES: Array<{ pattern: RegExp; title: string }> = [
  { pattern: /^why are you being asked to take part(?:\s+in this research study)?\??$/i, title: "Purpose" },
  { pattern: /^what is the purpose of (?:this study|the study)\??$/i, title: "Purpose" },
  { pattern: /^what will happen(?: during this study| if you take part)?\??$/i, title: "Study Procedures" },
  { pattern: /^what are the (?:possible )?risks(?: and discomforts)?\??$/i, title: "Risks" },
  { pattern: /^what are the benefits\??$/i, title: "Benefits" },
  { pattern: /^what are your alternatives\??$/i, title: "Alternatives" },
  { pattern: /^can you leave the study|^can i leave the study|^what happens if you leave/i, title: "Right to Withdraw" },
  { pattern: /^is it your choice to be in this study\??$/i, title: "Voluntary Participation" },
  { pattern: /^how will your information be kept private\??$/i, title: "Confidentiality" },
  { pattern: /^will it cost you anything\??$/i, title: "Costs" },
  { pattern: /^will you be paid\??$/i, title: "Payment" },
  { pattern: /^who can you contact\??$/i, title: "Contacts" },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const headingPattern = new RegExp(
  `^\\s*(?:(?:section\\s+)?\\d+[.)\\s:-]+)?(${HEADINGS.map(escapeRegExp).join("|")})\\s*[:?]?[ \\t]*$`,
  "i",
);

export function extractDocumentVersion(text: string): string | undefined {
  const match = text.match(
    /\b(?:document\s+)?(?:version|ver\.?|revision|rev\.?)\s*(?:(?:number|no\.?|#)\s*)?[:#-]?\s*(v?\d{1,3}(?:\.\d{1,3}){0,2})(?![\d./-])\b/i,
  );
  return match?.[1]?.replace(/^v/i, "");
}

export function extractTitle(text: string, fallback: string): string {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  return lines.find((line) => line.length >= 5 && line.length <= 160 && /(?:informed consent|consent form|consent to participate)/i.test(line))
    ?? lines.find((line) => line.length >= 5 && line.length <= 160)
    ?? fallback;
}

export function splitIntoSections(text: string): Array<{ id: string; title: string; text: string }> {
  const blocks: Array<{ title: string; lines: string[] }> = [];
  let current = { title: "Consent Form Overview", lines: [] as string[] };
  for (const line of text.split(/\r?\n/)) {
    const normalized = line.trim().replace(/\s+/g, " ");
    const alias = HEADING_ALIASES.find(({ pattern }) => pattern.test(normalized));
    const heading = normalized.match(headingPattern);
    if (heading || alias) {
      if (current.lines.join("\n").trim()) blocks.push(current);
      current = {
        title: alias?.title ?? (heading?.[1] ?? "Section").replace(/\b[a-z]/g, (character) => character.toUpperCase()),
        lines: [],
      };
    } else {
      current.lines.push(normalized);
    }
  }
  if (current.lines.join("\n").trim()) blocks.push(current);

  const substantive = blocks.filter((block) => block.lines.join("\n").trim().length >= 40);
  const sourceBlocks = substantive.length ? substantive : chunkText(text).map((chunk, index) => ({
    title: index === 0 ? "Consent Form Overview" : `Consent Form Details ${index + 1}`,
    lines: [chunk],
  }));

  return sourceBlocks.flatMap((block, index) => {
    const sectionText = block.lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    return chunkText(sectionText).map((text, chunkIndex) => ({
      id: createHash("sha256").update(`${index}:${chunkIndex}:${block.title}:${text}`).digest("hex").slice(0, 16),
      title: chunkIndex === 0 ? block.title : `${block.title} (continued)`,
      text,
    }));
  });
}

function chunkText(text: string, maxLength = 2400): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of text.split(/\n{2,}/)) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxLength) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      if (paragraph.length <= maxLength) current = paragraph;
      else {
        for (let offset = 0; offset < paragraph.length; offset += maxLength) {
          chunks.push(paragraph.slice(offset, offset + maxLength));
        }
        current = "";
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.filter((chunk) => chunk.trim().length > 0);
}
