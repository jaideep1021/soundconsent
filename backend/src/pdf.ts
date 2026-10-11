// Load the supported Node canvas globals before evaluating PDF.js. Its dynamic
// canvas require is not reliably traced into serverless bundles.
export async function createPdfParser(bytes: Buffer) {
  const { CanvasFactory, getData } = await import("pdf-parse/worker");
  const { PDFParse } = await import("pdf-parse");
  // Embed the worker instead of depending on a runtime-relative worker file.
  PDFParse.setWorker(getData());
  return new PDFParse({ data: bytes, CanvasFactory });
}
