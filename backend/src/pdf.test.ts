import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const exec = promisify(execFile);

test("parses a real PDF on cold start when PDF.js cannot dynamically require canvas", async () => {
  // A separate process prevents an earlier parser import from masking the failure.
  const { stdout } = await exec(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import assert from "node:assert/strict";
    import { readFile } from "node:fs/promises";
    const original = process.getBuiltinModule;
    process.getBuiltinModule = (id) => {
      const builtin = original(id);
      if (id !== "module") return builtin;
      return { ...builtin, createRequire: () => { throw new Error("Dynamic require unavailable in bundle"); } };
    };
    for (const name of ["DOMMatrix", "ImageData", "Path2D"]) delete globalThis[name];
    const { createPdfParser } = await import(${JSON.stringify(new URL("./pdf.ts", import.meta.url).href)});
    const bytes = await readFile(new URL(${JSON.stringify(new URL("../../sample_icfs/NCT01823991_ICF_001.pdf", import.meta.url).href)}));
    const parser = await createPdfParser(bytes);
    try {
      const text = await parser.getText();
      const info = await parser.getInfo();
      assert.equal(info.total, 13);
      assert.match(text.text, /Version\\s+#?10/i);
      console.log("PDF_COLD_START_OK");
    } finally { await parser.destroy(); }
  `]);
  assert.match(stdout, /PDF_COLD_START_OK/);
});
