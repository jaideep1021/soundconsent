import { PDFParse } from "pdf-parse";
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
      parser = new PDFParse({ data: input.bytes });
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
        sections,
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
