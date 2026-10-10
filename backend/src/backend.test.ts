import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { AuditLog } from "./audit.js";
import { createApp } from "./app.js";
import type { Config } from "./config.js";
import { DocumentService } from "./documents.js";
import { GeminiProvider } from "./gemini.js";
import { HttpError } from "./errors.js";
import { redactPii } from "./privacy.js";
import { cosineSimilarity, retrieveRelevant } from "./retrieval.js";
import { extractDocumentVersion, splitIntoSections } from "./sections.js";
import { HUMAN_HANDOFF, SessionService } from "./sessions.js";
import { JsonStore } from "./store.js";
import type { AiProvider, ConsentSection, GroundedAnswer } from "./types.js";
import { createLiveKitToken } from "./voice.js";

class FakeAi implements AiProvider {
  grades = [false, false, true];
  rephrases: boolean[] = [];
  async embed(): Promise<number[]> { return [1, 0]; }
  async createGuide(section: ConsentSection, rephrase = false) {
    this.rephrases.push(rephrase);
    return { summary: `This explains ${section.title}.`, question: `What does ${section.title} explain?` };
  }
  async grade(): Promise<boolean> { return this.grades.shift() ?? false; }
  async answerQuestion(): Promise<GroundedAnswer> {
    return { answer: "The form says visits happen monthly.", citations: ["Study Procedures"], requiresClinician: false };
  }
  async verifyAnswer(): Promise<boolean> { return true; }
}

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "teach-it-back-"));
  const store = new JsonStore(join(directory, "state.json"));
  const audit = new AuditLog(join(directory, "audit.jsonl"));
  await store.init();
  await audit.init();
  const sections: ConsentSection[] = [
    { id: "purpose", title: "Purpose", text: "The purpose is to learn about the study.", embedding: [1, 0] },
    { id: "procedures", title: "Study Procedures", text: "Visits happen monthly during the study.", embedding: [0, 1] },
  ];
  const document = await store.saveDocument({
    studyId: "demo-study",
    version: "1.0",
    title: "Demo Consent",
    pageCount: 2,
    uploadedAt: new Date().toISOString(),
    sections,
  });
  return { directory, store, audit, document, sections };
}

test("redacts emails, phone numbers, and SSNs before storing or sending text", () => {
  assert.equal(
    redactPii("My name is Jane Smith. Contact jane@example.org, 415-555-0198; SSN 123-45-6789; DOB: 01/02/1980"),
    "My name is [REDACTED_NAME]. Contact [REDACTED_EMAIL], [REDACTED_PHONE]; SSN [REDACTED_SSN]; [REDACTED_DOB]",
  );
});

test("extracts document versions and sections from consent-form headings", () => {
  assert.equal(extractDocumentVersion("Informed Consent Form\nDocument Version: 2.1"), "2.1");
  assert.equal(extractDocumentVersion("ICF Version 5 Dated 06/05/2021"), "5");
  assert.equal(extractDocumentVersion("Version Date: 11.11.2022"), undefined);
  const sections = splitIntoSections(
    "Purpose\nThis study aims to learn about a condition and the results may not help you.\n\nRisks\nThere may be discomfort and other side effects during the study.",
  );
  assert.deepEqual(sections.map((section) => section.title), ["Purpose", "Risks"]);
  assert.ok(sections.every((section) => section.id.length === 16 && section.text.length > 40));
});

test("ingests the bundled public PDF, extracts metadata, and rejects unapproved versions", async () => {
  const data = await fixture();
  try {
    const service = new DocumentService(data.store, data.audit, new FakeAi(), { "fixture-study": ["10"] });
    const bytes = await readFile(fileURLToPath(new URL("../../sample_icfs/NCT01823991_ICF_001.pdf", import.meta.url)));
    const document = await service.ingest({
      bytes,
      filename: "consent.pdf",
      mimeType: "application/pdf",
      studyId: "fixture-study",
      declaredVersion: "10",
    });
    assert.equal(document.version, "10");
    assert.equal(document.pageCount, 13);
    assert.ok(document.sections.length > 1);

    const outdatedService = new DocumentService(data.store, data.audit, new FakeAi(), { "fixture-study": ["9"] });
    await assert.rejects(
      () => outdatedService.ingest({
        bytes, filename: "consent.pdf", mimeType: "application/pdf", studyId: "fixture-study",
      }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409,
    );
  } finally {
    await rm(data.directory, { recursive: true, force: true });
  }
});

test("retrieves nearest embedded section and handles incompatible vectors", async () => {
  assert.ok(cosineSimilarity([1, 0], [0.8, 0.2]) > cosineSimilarity([1, 0], [0, 1]));
  assert.equal(cosineSimilarity([1], [1, 2]), 0);
  const ai = new FakeAi();
  const { sections } = await fixture();
  assert.deepEqual((await retrieveRelevant(ai, "visits", sections, 1)).map((section) => section.id), ["purpose"]);
});

test("Gemini grounding check replaces unsupported generated claims with the safe fallback", async () => {
  const originalFetch = globalThis.fetch;
  const generated = [
    { answer: "The form says visits happen monthly.", citations: ["Study Procedures"], requiresClinician: false },
    { supported: false },
  ];
  let call = 0;
  const requestBodies: string[] = [];
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(String(init?.body));
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(generated[call++]) }] } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const provider = new GeminiProvider("test-api-key", "test-model", "test-embedding");
    const answer = await provider.answerQuestion("Can I stop my medication?", [
      { id: "procedures", title: "Study Procedures", text: "Participant Name: Jane Smith\nThe visits happen monthly.", embedding: [1, 0] },
    ]);
    assert.deepEqual(answer, { answer: "Please ask your doctor.", citations: [], requiresClinician: true });
    assert.equal(call, 2);
    assert.ok(requestBodies.every((body) => !body.includes("Jane Smith")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("teach-back retries exactly once, flags the failure, and advances through sections", async () => {
  const data = await fixture();
  try {
    const ai = new FakeAi();
    const service = new SessionService(data.store, data.audit, ai);
    const started = await service.start(data.document);
    assert.match(started.message, /automated assistant/i);
    assert.match(started.message, /not a doctor/i);

    const retry = await service.respond(started.session.id, "I do not know");
    assert.equal(retry.status, "in_progress");
    assert.match(String(retry.message), /review this section another way/i);
    assert.equal(ai.rephrases.at(-1), true);
    const flagged = await service.respond(started.session.id, "Still unsure");
    assert.equal(flagged.status, "in_progress");
    assert.match(String(flagged.message), /flag "Purpose"/);
    assert.deepEqual(flagged.section, { index: 2, total: 2, title: "Study Procedures" });
    const completed = await service.respond(started.session.id, "We visit monthly");
    assert.equal(completed.status, "completed");
    assert.match(String(completed.message), /does not record your consent/i);

    const report = service.report(started.session.id);
    assert.equal(report.consentObtained, false);
    assert.equal(report.status, "completed");
    assert.deepEqual((report.sections as Array<{ outcome: string }>).map((item) => item.outcome), [
      "needs_human_follow_up", "passed",
    ]);
    const log = await readFile(join(data.directory, "audit.jsonl"), "utf8");
    assert.match(log, /teachback.flagged/);
    assert.match(log, /session.completed/);
  } finally {
    await rm(data.directory, { recursive: true, force: true });
  }
});

test("refuses unsupported questions and puts them in the coordinator report", async () => {
  const data = await fixture();
  try {
    const ai = new FakeAi();
    ai.answerQuestion = async () => ({ answer: "Please ask your doctor.", citations: [], requiresClinician: true });
    const service = new SessionService(data.store, data.audit, ai);
    const session = await service.start(data.document);
    const result = await service.ask(session.session.id, "Can I take my other medicine?");
    assert.equal(result.answer, "Please ask your doctor.");
    assert.equal(result.requiresClinician, true);
    const report = service.report(session.session.id);
    assert.equal((report.outOfScopeQuestions as unknown[]).length, 1);
  } finally {
    await rm(data.directory, { recursive: true, force: true });
  }
});

test("routes emergency and human requests directly to safe handoffs without an LLM call", async () => {
  const data = await fixture();
  try {
    const ai = new FakeAi();
    ai.embed = async () => { throw new Error("must not call the LLM"); };
    const service = new SessionService(data.store, data.audit, ai);
    const session = await service.start(data.document);
    const emergency = await service.ask(session.session.id, "I have chest pain");
    assert.equal(emergency.emergency, true);
    assert.match(String(emergency.answer), /call 911 now/);
    const handoff = await service.ask(session.session.id, "Please connect me to a nurse");
    assert.match(String(handoff.answer), /ask the study coordinator or nurse/);
    assert.equal((service.report(session.session.id).outOfScopeQuestions as unknown[]).length, 2);
  } finally {
    await rm(data.directory, { recursive: true, force: true });
  }
});

test("emergency phrases submitted as teach-back bypass grading and are reported", async () => {
  const data = await fixture();
  try {
    const ai = new FakeAi();
    ai.grade = async () => { throw new Error("emergency must not be graded"); };
    const service = new SessionService(data.store, data.audit, ai);
    const session = await service.start(data.document);
    const result = await service.respond(session.session.id, "I have chest pain");
    assert.equal(result.emergency, true);
    assert.match(String(result.message), /call 911 now/);
    assert.equal((service.report(session.session.id).outOfScopeQuestions as unknown[]).length, 1);
  } finally {
    await rm(data.directory, { recursive: true, force: true });
  }
});

test("audit hash chain detects tampering on restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "teach-it-back-audit-"));
  const file = join(directory, "audit.jsonl");
  try {
    const audit = new AuditLog(file);
    await audit.init();
    await audit.append("interaction", { email: "jane@example.org" });
    const line = await readFile(file, "utf8");
    assert.match(line, /\[REDACTED_EMAIL\]/);
    await writeFile(file, line.replace("interaction", "changed"));
    await assert.rejects(() => new AuditLog(file).init(), /integrity check failed/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("LiveKit token is a signed short-lived token and voice config fails explicitly", () => {
  const config = {
    liveKitUrl: "wss://livekit.example.test",
    liveKitApiKey: "api-key",
    liveKitApiSecret: "test-secret",
  } as Config;
  const result = createLiveKitToken(config, "session-123");
  const [header, claims, signature] = result.token.split(".");
  assert.ok(header && claims && signature);
  assert.deepEqual(JSON.parse(Buffer.from(claims, "base64url").toString()).video, {
    roomJoin: true,
    room: "consent-session-123",
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  assert.throws(
    () => createLiveKitToken({ ...config, liveKitApiSecret: "" }, "session"),
    (error: unknown) => error instanceof HttpError && error.statusCode === 503,
  );
});

test("HTTP API health, coordinator auth, and patient response validation", async () => {
  const data = await fixture();
  const config: Config = {
    port: 3001,
    dataDir: data.directory,
    stateFile: join(data.directory, "state.json"),
    auditFile: join(data.directory, "audit.jsonl"),
    approvedVersions: { "demo-study": ["1.0"], "fixture-study": ["10"] },
    coordinatorApiKey: "coordinator-secret",
    corsOrigins: ["http://localhost:5173"],
    geminiApiKey: "",
    geminiModel: "test",
    geminiEmbeddingModel: "test-embed",
    elevenLabsApiKey: "",
    elevenLabsVoiceId: "",
    deepgramApiKey: "",
    liveKitUrl: "",
    liveKitApiKey: "",
    liveKitApiSecret: "",
  };
  const app = await createApp({ config, ai: new FakeAi(), store: data.store, audit: data.audit });
  try {
    const health = await app.inject({ method: "GET", url: "/health" });
    assert.equal(health.statusCode, 200);
    const unauthorized = await app.inject({
      method: "POST",
      url: "/sessions",
      payload: { documentId: data.document.id },
    });
    assert.equal(unauthorized.statusCode, 401);
    const samplePdf = await readFile(fileURLToPath(new URL("../../sample_icfs/NCT01823991_ICF_001.pdf", import.meta.url)));
    const boundary = "backend-test-boundary";
    const multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="studyId"\r\n\r\nfixture-study\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="consent.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      samplePdf,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const uploaded = await app.inject({
      method: "POST",
      url: "/documents",
      headers: {
        authorization: "Bearer coordinator-secret",
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipartBody,
    });
    assert.equal(uploaded.statusCode, 201, uploaded.body);
    assert.equal(uploaded.json().version, "10");
    const started = await app.inject({
      method: "POST",
      url: "/sessions",
      headers: { authorization: "Bearer coordinator-secret" },
      payload: { documentId: uploaded.json().id },
    });
    assert.equal(started.statusCode, 201);
    const { sessionId } = started.json() as { sessionId: string };
    const invalid = await app.inject({
      method: "POST",
      url: `/sessions/${sessionId}/responses`,
      payload: { response: "" },
    });
    assert.equal(invalid.statusCode, 400);
    const reportUnauthorized = await app.inject({ method: "GET", url: `/sessions/${sessionId}/report` });
    assert.equal(reportUnauthorized.statusCode, 401);
    const report = await app.inject({
      method: "GET",
      url: `/sessions/${sessionId}/report`,
      headers: { authorization: "Bearer coordinator-secret" },
    });
    assert.equal(report.statusCode, 200);
    assert.equal(report.json().consentObtained, false);
  } finally {
    await app.close();
    await rm(data.directory, { recursive: true, force: true });
  }
});
