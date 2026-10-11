import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadConfig } from "./config.js";

test("approval configuration stays fail-closed across Vercel and Docker paths", async (t) => {
  const originalEnv = { ...process.env };
  const originalCwd = process.cwd();
  const directory = await mkdtemp(join(tmpdir(), "soundconsent-config-"));
  try {
    for (const key of Object.keys(process.env)) delete process.env[key];
    process.env.DATA_DIR = directory;
    process.env.VERCEL = "1";
    process.chdir(directory);
    const bundled = JSON.parse(await readFile(new URL("../data/approved-versions.json", import.meta.url), "utf8"));
    await t.test("bundled approvals work outside the backend working directory", async () => {
      assert.deepEqual((await loadConfig()).approvedVersions, bundled);
    });
    const override = join(directory, "override.json");
    process.env.APPROVED_VERSIONS_FILE = override;
    await t.test("missing explicit override never falls back to bundled approvals", async () => {
      await assert.rejects(loadConfig(), /Could not load approved versions file/);
    });
    await t.test("empty Docker-style override approves nothing", async () => {
      await writeFile(override, "{}");
      assert.deepEqual((await loadConfig()).approvedVersions, {});
    });
    await t.test("explicit override replaces rather than merges bundled approvals", async () => {
      await writeFile(override, JSON.stringify({ institution: ["7"] }));
      assert.deepEqual((await loadConfig()).approvedVersions, { institution: ["7"] });
    });
    await t.test("malformed JSON and invalid approval shapes stop startup", async () => {
      await writeFile(override, "{");
      await assert.rejects(loadConfig(), /Could not load approved versions file/);
      for (const value of [null, [], { study: "7" }, { study: [7] }]) {
        await writeFile(override, JSON.stringify(value));
        await assert.rejects(loadConfig(), /Approved versions must map/);
      }
    });
    await t.test("local DATA_DIR remains authoritative and missing files fail closed", async () => {
      delete process.env.VERCEL;
      delete process.env.APPROVED_VERSIONS_FILE;
      await assert.rejects(loadConfig(), /Could not load approved versions file/);
      await writeFile(join(directory, "approved-versions.json"), JSON.stringify({ local: ["2"] }));
      assert.deepEqual((await loadConfig()).approvedVersions, { local: ["2"] });
    });
  } finally {
    process.chdir(originalCwd);
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    await rm(directory, { recursive: true, force: true });
  }
});
