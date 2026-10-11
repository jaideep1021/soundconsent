import { randomUUID } from "node:crypto";
import type { PDFParse } from "pdf-parse";
import { createPdfParser } from "./pdf.js";
import { HttpError } from "./errors.js";
import { extractDocumentVersion, extractTitle, splitIntoSections } from "./sections.js";
import type { AiProvider, ConsentDocument } from "./types.js";
import { JsonStore } from "./store.js";
import type { AuditLog } from "./audit.js";

export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export class DocumentService {
  constructor(
    private readonly store: JsonStore,
    private readonly audit: AuditLog,
    private readonly ai: AiProvider,
    private readonly approvedVersions: Record<string, string[]>,
  ) {}

  async draft(source: ConsentDocument, input: Record<string, unknown>, accountId: string) {
    const version = input.version;
    if (typeof version !== "string" || !/^[A-Za-z0-9._-]{1,50}$/.test(version) || version === source.version) throw new HttpError(400, "Choose a different version (letters, digits, dots, underscores or hyphens)");
    const draft = await this.store.saveDocument({ studyId: source.studyId, version, title: source.title, pageCount: source.pageCount,
      sections: source.sections.map((s) => ({ ...s, id: randomUUID(), embedding: [] })), uploadedAt: new Date().toISOString(), parentId: source.id, lifecycle: "draft", revision: 0 });
    await this.audit.append("document.drafted", { documentId: draft.id, parentId: source.id, accountId });
    return draft;
  }

  async edit(document: ConsentDocument, input: Record<string, unknown>, accountId: string) {
    if (document.lifecycle !== "draft") throw new HttpError(409, "Only drafts can be edited; create a new version first");
    if (!Number.isInteger(input.revision) || input.revision !== (document.revision ?? 0)) throw new HttpError(409, "Document changed; refresh and retry");
    if (typeof input.title !== "string" || !input.title.trim() || input.title.length > 300 || !Array.isArray(input.sections) || !input.sections.length || input.sections.length > 100) throw new HttpError(400, "Provide a title and 1–100 sections");
    let total = 0;
    const sections = input.sections.map((raw: unknown) => {
      if (!raw || typeof raw !== "object") throw new HttpError(400, "Invalid section");
      const s = raw as Record<string, unknown>;
      if (typeof s.title !== "string" || !s.title.trim() || s.title.length > 300 || typeof s.text !== "string" || !s.text.trim() || s.text.length > 50000) throw new HttpError(400, "Each section needs a title and text (maximum 50,000 characters)");
      total += s.text.length;
      return { id: randomUUID(), title: s.title.trim(), text: s.text.trim(), embedding: [] as number[] };
    });
    if (total > 500000) throw new HttpError(413, "Document text is too large");
    await this.store.updateDocument({ ...document, title: input.title.trim(), sections }, Number(input.revision));
    await this.audit.append("document.edited", { documentId: document.id, accountId });
    return this.store.getDocument(document.id)!;
  }

  async publish(document: ConsentDocument, revision: unknown, accountId: string) {
    if (document.lifecycle !== "draft") throw new HttpError(409, "Only drafts can be published");
    if (!Number.isInteger(revision) || revision !== (document.revision ?? 0)) throw new HttpError(409, "Document changed; refresh and retry");
    if (!(this.approvedVersions[document.studyId] ?? []).includes(document.version)) throw new HttpError(409, "Version must be approved in the server approved-versions configuration before publication");
    const sections = await mapWithConcurrency(document.sections, 4, async (section) => ({ ...section, embedding: await this.ai.embed(section.text) }));
    await this.store.updateDocument({ ...document, sections, lifecycle: "published", approvedBy: accountId, approvedAt: new Date().toISOString() }, Number(revision));
    await this.audit.append("document.published", { documentId: document.id, version: document.version, accountId });
    return this.store.getDocument(document.id)!;
  }

  async archive(document: ConsentDocument, revision: unknown, accountId: string) {
    if (!Number.isInteger(revision) || revision !== (document.revision ?? 0)) throw new HttpError(409, "Document changed; refresh and retry");
    await this.store.updateDocument({ ...document, lifecycle: "archived" }, Number(revision));
    await this.audit.append("document.archived", { documentId: document.id, accountId });
    return this.store.getDocument(document.id)!;
  }

  async ingest(input: {
    bytes: Buffer;
    filename: string;
    mimeType: string;
    studyId: string;
    declaredVersion?: string;
  }): Promise<ConsentDocument> {
    if (input.bytes.length === 0) throw new HttpError(400, "Uploaded PDF is empty");
    if (input.bytes.length > MAX_PDF_BYTES) throw new HttpError(413, "PDF exceeds the 20 MiB upload limit");
    if (!input.filename.toLowerCase().endsWith(".pdf") || !["application/pdf", "application/octet-stream"].includes(input.mimeType)) {
      throw new HttpError(415, "Upload must be a PDF file");
    }
    if (!/^[A-Za-z0-9._-]{1,100}$/.test(input.studyId)) throw new HttpError(400, "Invalid studyId");
    let parser: PDFParse | undefined;

    try {
      parser = await createPdfParser(input.bytes);
      const parsed = await parser.getText();
      const info = await parser.getInfo();
      const text = parsed.text.replace(/\u0000/g, "").trim();
      if (text.length < 40) throw new HttpError(422, "PDF contains no extractable consent text; scanned PDFs require OCR");
      const version = extractDocumentVersion(text);
      if (!version) throw new HttpError(422, "Could not find a document version in the PDF text");
      if (input.declaredVersion && input.declaredVersion !== version) {
        throw new HttpError(422, `Declared version ${input.declaredVersion} does not match PDF version ${version}`);
      }
      const approved = this.approvedVersions[input.studyId] ?? [];
      if (!approved.includes(version)) throw new HttpError(409, `Document version ${version} is not approved for study ${input.studyId}`);
      const chunks = splitIntoSections(text);
      if (!chunks.length) throw new HttpError(422, "Could not divide the PDF into readable sections");
      const sections = await mapWithConcurrency(chunks, 4, async (chunk) => ({
        ...chunk,
        embedding: await this.ai.embed(chunk.text),
      }));
      const document = await this.store.saveDocument({
        studyId: input.studyId,
        version,
        title: extractTitle(text, input.filename.replace(/\.pdf$/i, "")),
        pageCount: info.total,
        uploadedAt: new Date().toISOString(),
        sections, lifecycle: "published", revision: 0,
      });
      await this.audit.append("document.uploaded", {
        documentId: document.id,
        studyId: document.studyId,
        version,
        title: document.title,
        pageCount: document.pageCount,
        sectionCount: document.sections.length,
        filename: input.filename,
      });
      return document;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(422, `Could not process PDF: ${error instanceof Error ? error.message : "invalid PDF"}`);
    } finally {
      if (parser) await parser.destroy();
    }
  }

}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  map: (item: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      const item = items[index];
      if (item === undefined) return;
      output[index] = await map(item);
    }
  }));
  return output;
}
