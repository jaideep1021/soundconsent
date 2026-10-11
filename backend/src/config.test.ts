import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadConfig, parseCorsOrigins } from "./config.js";

test("approval configuration stays fail-closed across Vercel and Docker paths", async (t) => {
  const originalEnv = { ...process.env };
  const originalCwd = process.cwd();
  const directory = await mkdtemp(join(tmpdir(), "soundconsent-config-"));
  try {
    for (const key of Object.keys(process.env)) delete process.env[key];
    process.env.DATA_DIR = directory;
    process.env.VERCEL = "1";
    process.env.DATABASE_URL = "postgresql://localhost/test";
    process.chdir(directory);
    await t.test("Vercel rejects missing database configuration and unsupported notification worker", async () => {
      delete process.env.DATABASE_URL;
      await assert.rejects(loadConfig(), /DATABASE_URL is required on Vercel/);
      process.env.DATABASE_URL = "not-a-url";
      await assert.rejects(loadConfig(), /Postgres connection URL/);
      process.env.DATABASE_URL = "postgresql://localhost/test";
      process.env.NOTIFICATION_DELIVERY_ENABLED = "true";
      await assert.rejects(loadConfig(), /durable worker/);
      delete process.env.NOTIFICATION_DELIVERY_ENABLED;
    });
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

test("CORS normalizes root slashes, casing and default ports to exact origins", () => {
  assert.deepEqual(parseCorsOrigins(" https://FRONTEND.example.com:443/, http://localhost:5173/, https://frontend.example.com "),
    ["https://frontend.example.com", "http://localhost:5173"]);
  assert.deepEqual(parseCorsOrigins("https://frontend.example.com:8443"), ["https://frontend.example.com:8443"]);
});

test("CORS rejects unsafe and ambiguous configuration without exposing its value", () => {
  for (const value of ["", " ", "*", "https://*.example.com", "null", "example.com", "ftp://example.com",
    '"https://example.com"', "https://example.com/dashboard", "https://example.com//", "https://example.com/..",
    "https://example.com?x=1", "https://example.com#x", "https://user:secret@example.com",
    "https://example.com,", "https://example.com,,http://localhost:5173", "https://example.com\\evil",
    "https://example.com https://other.example.com"]) {
    assert.throws(() => parseCorsOrigins(value), /CORS_ORIGIN must be a comma-separated list/);
  }
  assert.throws(() => parseCorsOrigins("https://user:secret@example.com"), (error: unknown) =>
    error instanceof Error && !error.message.includes("secret"));
});
