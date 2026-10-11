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
import { ElevenLabsAgentService } from "./elevenlabs-agent.js";
import { GeminiProvider } from "./gemini.js";
import { HttpError } from "./errors.js";
import { redactPii } from "./privacy.js";
import { cosineSimilarity, retrieveRelevant } from "./retrieval.js";
import { extractDocumentVersion, splitIntoSections } from "./sections.js";
import { HUMAN_HANDOFF, SessionService } from "./sessions.js";
import { JsonStore } from "./store.js";
import type { AiProvider, ConsentSection, GroundedAnswer } from "./types.js";
import { audioResponse } from "./voice.js";

class FakeAi implements AiProvider {
  async classifyMessage(): Promise<"response"> { return "response"; }
  grades = [false, false, true];
  rephrases: boolean[] = [];
  async transcribeAudio(): Promise<string> { return "I understand the study visits."; }
  async embed(): Promise<number[]> { return [1, 0]; }
  async createGuide(section: ConsentSection, rephrase = false) {
    this.rephrases.push(rephrase);
    return { summary: `This explains ${section.title}.`, question: `What does ${section.title} explain?` };
  }
  async grade(_section: ConsentSection, _response: string, _question: string): Promise<boolean> { return this.grades.shift() ?? false; }
  async answerQuestion(_question: string, _sections: ConsentSection[]): Promise<GroundedAnswer> {
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
    assert.match(answer.answer, /don't have enough reliable information/);
    assert.match(answer.answer, /clarify what to ask/);
    assert.deepEqual(answer.citations, []);
    assert.equal(answer.requiresClinician, true);
    assert.equal(call, 2);
    assert.ok(requestBodies.every((body) => !body.includes("Jane Smith")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Gemini retains verified sensitive explanations and general information without source citations", async () => {
  const originalFetch = globalThis.fetch;
  const explanation = {
    answer: "General information: personal circumstances can affect how study information applies to you. Which part would you like to clarify?",
    citations: [],
    requiresClinician: true,
  };
  const generated = [explanation, { supported: true }];
  const requests: Array<{ systemInstruction: { parts: Array<{ text: string }> }; contents: Array<{ parts: Array<{ text: string }> }> }> = [];
  globalThis.fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(generated.shift()) }] } }] });
  };
  try {
    const provider = new GeminiProvider("test-key", "test-model", "test-embedding");
    assert.deepEqual(await provider.answerQuestion("What does this mean for my health?", []), explanation);
    assert.equal(requests.length, 2, "Sensitive explanations must still be verified");
    const verification = JSON.parse(requests[1]!.contents[0]!.parts[0]!.text);
    assert.equal(verification.requiresClinician, true);
    assert.deepEqual(verification.sections, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Gemini rejects fabricated citations before accepting an educational answer", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      answer: "The study covers every medical expense.", citations: ["Invented section"], requiresClinician: true,
    }) }] } }] });
  };
  try {
    const provider = new GeminiProvider("test-key", "test-model", "test-embedding");
    const answer = await provider.answerQuestion("What expenses are covered?", []);
    assert.match(answer.answer, /don't have enough reliable information/);
    assert.deepEqual(answer.citations, []);
    assert.equal(answer.requiresClinician, true);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Gemini grading receives the exact redacted question and refuses an empty question", async () => {
  const originalFetch = globalThis.fetch;
  const inputs: unknown[] = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    inputs.push(JSON.parse(body.contents[0].parts[0].text));
    return Response.json({ candidates: [{ content: { parts: [{ text: '{"pass":true}' }] } }] });
  };
  try {
    const provider = new GeminiProvider("test-key", "test-model", "test-embedding");
    const section = { id: "visits", title: "Visits", text: "Visits happen monthly. Contact nurse@example.org.", embedding: [] };
    const question = "How often are visits? Contact nurse@example.org for help.";
    assert.equal(await provider.grade(section, "Monthly; my email is patient@example.org.", question), true);
    assert.deepEqual(inputs, [{
      source: "Visits happen monthly. Contact [REDACTED_EMAIL].",
      question: "How often are visits? Contact [REDACTED_EMAIL] for help.",
      patientResponse: "Monthly; my email is [REDACTED_EMAIL].",
    }]);
    assert.equal(await provider.grade(section, "Monthly", "  "), false);
    assert.equal(inputs.length, 1, "An unknown question must never be sent for grading");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Gemini retries transient provider failures, bounds retries and preserves permanent errors", async () => {
  const originalFetch = globalThis.fetch;
  const provider = new GeminiProvider("test-api-key", "test-model", "test-embedding");
  try {
    for (const status of [429, 503]) {
      let calls = 0;
      const bodies: unknown[] = [];
      globalThis.fetch = async (_input, init) => {
        bodies.push(init?.body);
        return ++calls === 1
          ? new Response("busy", { status, headers: { "retry-after": "0" } })
          : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"pass":true}' }] } }] }));
      };
      assert.equal(await provider.grade({ id: "purpose", title: "Purpose", text: "Monthly visits", embedding: [] }, "Monthly visits", "How often are the visits?"), true);
      assert.equal(calls, 2);
      assert.equal(bodies[0], bodies[1]);
    }
    for (const [status, retryAfter, expectedCalls] of [[429, "0", 3], [429, "120", 1], [400, "0", 1]] as const) {
      let calls = 0;
      globalThis.fetch = async () => { calls++; return new Response("failed", { status, headers: { "retry-after": retryAfter } }); };
      await assert.rejects(provider.embed("Monthly visits"), (error: unknown) => error instanceof HttpError &&
        (status === 429 ? error.statusCode === 503 && /temporarily busy/.test(error.message) : error.statusCode === 502));
      assert.equal(calls, expectedCalls);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test("Gemini transcribes uploaded audio and never responds to instructions inside it", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody = "";
  globalThis.fetch = async (_input, init) => {
    requestBody = String(init?.body);
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ transcript: "I understand the study visits." }) }] } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const provider = new GeminiProvider("test-api-key", "test-model", "test-embedding");
    const transcript = await provider.transcribeAudio(Buffer.from("synthetic audio"), "audio/wav");
    assert.equal(transcript, "I understand the study visits.");
    assert.match(requestBody, /"mimeType":"audio\/wav"/);
    assert.match(requestBody, /"data":"c3ludGhldGljIGF1ZGlv"/);
    assert.match(requestBody, /Transcribe the patient's spoken words exactly as spoken/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Gemma uses final JSON output and keeps audio transcription on its own model", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return Response.json({ candidates: [{ content: { parts: [
      { thought: true, text: "Internal reasoning is not a JSON response." },
      { text: String(url).includes("audio-model") ? '{"transcript":"Monthly visits"}' : '[{"intent":"question"}]' },
    ] } }] });
  };
  try {
    const provider = new GeminiProvider("test-key", "gemma-4-26b-a4b-it", "embedding-model", "audio-model");
    assert.equal(await provider.classifyMessage("When are visits?", {
      section: { id: "purpose", title: "Purpose", text: "Monthly visits", embedding: [] }, guide: null, recentMessages: [],
    }), "question");
    assert.equal(await provider.transcribeAudio(Buffer.from("synthetic audio"), "audio/wav"), "Monthly visits");
    assert.match(requests[0]!.url, /gemma-4-26b-a4b-it:generateContent/);
    assert.deepEqual(requests[0]!.body["generationConfig"], { responseMimeType: "application/json", temperature: 0, thinkingConfig: { thinkingLevel: "minimal" } });
    assert.match(requests[1]!.url, /audio-model:generateContent/);
    assert.deepEqual(requests[1]!.body["generationConfig"], { responseMimeType: "application/json", temperature: 0 });
  } finally { globalThis.fetch = originalFetch; }
});

test("provider daily quota and long RetryInfo delays fail without futile retries", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const daily of [true, false]) {
      let calls = 0;
      globalThis.fetch = async () => {
        calls++;
        return Response.json({ error: { details: [
          ...(daily ? [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }] : []),
          { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "63871s" },
        ] } }, { status: 429 });
      };
      const provider = new GeminiProvider("test-key", "test-model", "test-embedding");
      await assert.rejects(provider.embed("Monthly visits"), daily ? /daily usage limit/ : /temporarily busy/);
      assert.equal(calls, 1);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test("ElevenLabs provisions browser tools without exposing webhook secrets or requiring a tunnel", async () => {
  const data = await fixture();
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string; headers: Headers; body?: string }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === "string" ? init.body : undefined;
    requests.push({ url, method, headers, ...(body ? { body } : {}) });
    if (url.includes("/tools?search=")) {
      return Response.json({ tools: [], has_more: false });
    }
    if (url.endsWith("/tools") && method === "POST") {
      const index = requests.filter((request) => request.url.endsWith("/tools") && request.method === "POST").length;
      return Response.json({ id: `tool-${index}` });
    }
    if (/\/tools\/tool-[12]$/.test(url) && method === "PATCH") {
      return Response.json({ id: url.endsWith("tool-1") ? "tool-1" : "tool-2" });
    }
    if (url.endsWith("/agents/create")) return Response.json({ agent_id: "agent-test" });
    if (url.endsWith("/agents/agent-test") && method === "PATCH") return Response.json({ agent_id: "agent-test" });
    if (url.includes("/conversation/get-signed-url?")) {
      return Response.json({ signed_url: "wss://api.elevenlabs.io/v1/convai/conversation?token=temporary" });
    }
    throw new Error(`Unexpected ElevenLabs request ${method} ${url}`);
  };
  try {
    const config: Config = {
      port: 3001,
      dataDir: data.directory,
      stateFile: join(data.directory, "state.json"),
      auditFile: join(data.directory, "audit.jsonl"),
      approvedVersions: {},
      coordinatorApiKey: "coordinator-secret",
      allowLegacyApiKey: true,
      corsOrigins: [],
      geminiApiKey: "gemini-test-key",
      geminiModel: "gemini-2.5-flash",
      geminiEmbeddingModel: "gemini-embedding-001",
      elevenLabsApiKey: "elevenlabs-test-key",
      elevenLabsVoiceId: "voice-test",
      elevenLabsToolApiKey: "a".repeat(40),
      elevenLabsAgentId: "",
      publicBaseUrl: "https://consent.example.org/api",
    };
    const agent = new ElevenLabsAgentService(config, data.store);
    const provisioned = await agent.provision();
    assert.deepEqual(provisioned, { agentId: "agent-test", updated: false });
    assert.equal(data.store.getElevenLabsAgentId(), "agent-test");
    assert.ok(data.store.getElevenLabsToolId("teach_it_back_answer_consent_question"));
    assert.ok(data.store.getElevenLabsToolId("teach_it_back_submit_teach_back"));

    const toolRequests = requests.filter((request) => request.url.endsWith("/tools") && request.method === "POST");
    assert.equal(toolRequests.length, 2);
    assert.ok(toolRequests.every((request) => request.headers.get("xi-api-key") === "elevenlabs-test-key"));
    for (const request of toolRequests) {
      const tool = JSON.parse(request.body!).tool_config;
      assert.equal(tool.type, "client");
      assert.equal(tool.expects_response, true);
      assert.equal(tool.api_schema, undefined);
      assert.ok(!request.body!.includes("Bearer"));
      assert.ok(!request.body!.includes("sessionAccess"));
      assert.ok(!request.body!.includes("expectedRevision"));
    }
    const createdAgent = requests.find((request) => request.url.endsWith("/agents/create"));
    assert.ok(createdAgent?.body);
    const agentBody = JSON.parse(createdAgent.body) as {
      conversation_config: {
        agent: { prompt: { llm: string; tool_ids: string[]; prompt: string }; first_message: string };
        tts: { model_id: string };
        conversation: { client_events: string[] };
      };
      platform_settings: { auth: { enable_auth: boolean }; privacy: { record_voice: boolean } };
    };
    assert.equal(agentBody.conversation_config.agent.prompt.llm, "gemini-2.5-flash");
    assert.equal(agentBody.conversation_config.tts.model_id, "eleven_turbo_v2");
    for (const event of ["audio", "interruption", "ping", "user_transcript", "agent_response", "client_tool_call"]) {
      assert.ok(agentBody.conversation_config.conversation.client_events.includes(event), `Missing streaming event: ${event}`);
    }
    assert.deepEqual(agentBody.conversation_config.agent.prompt.tool_ids, ["tool-1", "tool-2"]);
    assert.match(agentBody.conversation_config.agent.prompt.prompt, /never invent facts/i);
    assert.equal(agentBody.conversation_config.agent.first_message, "{{opening_message}}");
    assert.equal(agentBody.platform_settings.auth.enable_auth, true);
    assert.equal(agentBody.platform_settings.privacy.record_voice, false);

    assert.deepEqual(await agent.provision(), { agentId: "agent-test", updated: true });
    assert.equal(requests.filter((request) => request.method === "POST" && request.url.endsWith("/tools")).length, 2);
    assert.equal(requests.filter((request) => request.method === "PATCH" && /\/tools\/tool-[12]$/.test(request.url)).length, 2);
    assert.ok(requests.some((request) => request.method === "PATCH" && request.url.endsWith("/agents/agent-test")));
    const restoredStore = new JsonStore(join(data.directory, "state.json"));
    await restoredStore.init();
    assert.equal(restoredStore.getElevenLabsAgentId(), "agent-test");
    assert.equal(restoredStore.getElevenLabsToolId("teach_it_back_submit_teach_back"), "tool-2");

    assert.equal(await agent.getSignedUrl(), "wss://api.elevenlabs.io/v1/convai/conversation?token=temporary");
    assert.equal(requests.at(-1)?.headers.get("xi-api-key"), "elevenlabs-test-key");
  } finally {
    globalThis.fetch = originalFetch;
    await rm(data.directory, { recursive: true, force: true });
  }
});

test("ElevenLabs API errors include validation details without exposing configured keys", async () => {
  const data = await fixture();
  try {
    const config: Config = {
      port: 3001,
      dataDir: data.directory,
      stateFile: join(data.directory, "state.json"),
      auditFile: join(data.directory, "audit.jsonl"),
      approvedVersions: {},
      coordinatorApiKey: "coordinator-secret",
      allowLegacyApiKey: true,
      corsOrigins: [],
      geminiApiKey: "",
      geminiModel: "gemini-2.5-flash",
      geminiEmbeddingModel: "gemini-embedding-001",
      elevenLabsApiKey: "private-elevenlabs-key",
      elevenLabsVoiceId: "",
      elevenLabsToolApiKey: "private-tool-key-longer-than-32-characters",
      elevenLabsAgentId: "",
      publicBaseUrl: "https://consent.example.org",
    };
    const service = new ElevenLabsAgentService(config, data.store, async () =>
      Response.json({
        detail: [{ loc: ["body", "tool_config", "api_schema"], msg: "Invalid request schema", type: "value_error" }],
        echoed: config.elevenLabsApiKey,
      }, { status: 400 }),
    );
    await assert.rejects(
      () => service.provision(),
      (error: unknown) =>
        error instanceof HttpError &&
        error.statusCode === 502 &&
        error.message.includes("body.tool_config.api_schema: Invalid request schema") &&
        !error.message.includes(config.elevenLabsApiKey) &&
        !error.message.includes(config.elevenLabsToolApiKey),
    );
  } finally {
    await rm(data.directory, { recursive: true, force: true });
  }
});

test("audio endpoint uses Gemini transcription and records the processed voice response", async () => {
  const data = await fixture();
  try {
    const ai = new FakeAi();
    const service = new SessionService(data.store, data.audit, ai);
    const session = await service.start(data.document);
    const result = await audioResponse(ai, session.session.id, data.store, service, data.audit, Buffer.from("fake audio"), "audio/wav");
    assert.equal(result.sessionId, session.session.id);
    assert.match(String(result.message), /review this section another way/i);
    const audit = await readFile(join(data.directory, "audit.jsonl"), "utf8");
    assert.match(audit, /voice\.transcribed/);
  } finally {
    await rm(data.directory, { recursive: true, force: true });
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

test("grading preserves the displayed question through Q&A, re-explanation and restart", async () => {
  const data = await fixture();
  try {
    const ai = new FakeAi();
    ai.createGuide = async (_section, rephrase = false) => ({
      summary: "This study aims to learn about the condition.",
      question: rephrase ? "What are the researchers hoping to learn?" : "What is this study's purpose?",
    });
    const graded: Array<{ question: string; response: string }> = [];
    ai.grade = async (_section: ConsentSection, response: string, question: string) => {
      graded.push({ question, response });
      return graded.length > 1;
    };
    const service = new SessionService(data.store, data.audit, ai);
    const started = await service.start(data.document);
    await service.ask(started.session.id, "How often are visits?");
    await service.respond(started.session.id, "I am unsure of the purpose");
    const restored = new JsonStore(join(data.directory, "state.json"));
    await restored.init();
    const resumed = new SessionService(restored, data.audit, ai);
    await resumed.ask(started.session.id, "Can you explain the visits?");
    await resumed.respond(started.session.id, "The researchers want to learn about the condition");
    assert.deepEqual(graded, [
      { question: "What is this study's purpose?", response: "I am unsure of the purpose" },
      { question: "What are the researchers hoping to learn?", response: "The researchers want to learn about the condition" },
    ]);
    assert.equal(restored.getSession(started.session.id)?.sectionIndex, 1);
  } finally {
    await rm(data.directory, { recursive: true, force: true });
  }
});

test("legacy reviews without a saved question re-explain instead of inventing a passing assessment", async () => {
  const data = await fixture();
  try {
    const ai = new FakeAi();
    ai.grade = async () => { throw new Error("Cannot grade without the displayed question"); };
    const service = new SessionService(data.store, data.audit, ai);
    const started = await service.start(data.document);
    delete started.session.guide;
    await data.store.saveSession(started.session);
    const result = await service.respond(started.session.id, "The study teaches us about the condition");
    assert.match(String(result.message), /review this section another way/i);
    const saved = data.store.getSession(started.session.id)!;
    assert.equal(saved.sectionIndex, 0);
    assert.equal(saved.results.length, 0);
    assert.ok(saved.guide?.question);
  } finally {
    await rm(data.directory, { recursive: true, force: true });
  }
});

test("preserves helpful sensitive answers, recommends doctor confirmation, and persists report flags", async () => {
  const data = await fixture();
  try {
    const ai = new FakeAi();
    const explanation = "The form says visits happen monthly. Your study team can clarify how to plan around your other care.";
    ai.answerQuestion = async () => ({ answer: explanation, citations: ["Study Procedures"], requiresClinician: true });
    const service = new SessionService(data.store, data.audit, ai);
    const session = await service.start(data.document);
    const question = "How do monthly visits fit with my other care?";
    const options = { key: "sensitive-question-retry", revision: 0 };
    const result = await service.ask(session.session.id, question, options);
    assert.ok(String(result.answer).startsWith(explanation));
    assert.match(String(result.answer), /strongly recommend confirming.*with your doctor before acting/);
    assert.match(String(result.answer), /flagged your question in your report/);
    assert.deepEqual(result.citations, ["Study Procedures"]);
    assert.equal(result.requiresClinician, true);
    assert.deepEqual(await service.ask(session.session.id, question, options), result);
    const restored = new JsonStore(join(data.directory, "state.json"));
    await restored.init();
    const report = new SessionService(restored, data.audit, ai).report(session.session.id);
    const flags = report.outOfScopeQuestions as Array<{ question: string }>;
    assert.equal(flags.length, 1);
    assert.equal(flags[0]?.question, question);
    assert.equal(restored.getSession(session.session.id)?.transcript?.at(-1)?.content, result.answer);
    assert.match(await readFile(join(data.directory, "audit.jsonl"), "utf8"), /question.escalated/);
  } finally {
    await rm(data.directory, { recursive: true, force: true });
  }
});

test("answers questions even when retrieval finds no matching source sections", async () => {
  const data = await fixture();
  try {
    const ai = new FakeAi();
    ai.embed = async () => [0, 0];
    let answered = false;
    ai.answerQuestion = async (_question, sections) => {
      answered = true;
      assert.deepEqual(sections, []);
      return { answer: "I can help you prepare questions for your study team. Which topic would you like to discuss?", citations: [], requiresClinician: false };
    };
    const service = new SessionService(data.store, data.audit, ai);
    const session = await service.start(data.document);
    const result = await service.ask(session.session.id, "Can you help me prepare questions?");
    assert.equal(answered, true);
    assert.match(String(result.answer), /prepare questions/);
    assert.equal(result.requiresClinician, false);
    assert.deepEqual(service.report(session.session.id).outOfScopeQuestions, []);
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

test("HTTP API health, coordinator auth, and patient response validation", async () => {
  const data = await fixture();
  const config: Config = {
    port: 3001,
    dataDir: data.directory,
    stateFile: join(data.directory, "state.json"),
    auditFile: join(data.directory, "audit.jsonl"),
    approvedVersions: { "demo-study": ["1.0"], "fixture-study": ["10"] },
    coordinatorApiKey: "coordinator-secret",
      allowLegacyApiKey: true,
    corsOrigins: ["http://localhost:5173"],
    geminiApiKey: "",
    geminiModel: "test",
    geminiEmbeddingModel: "test-embed",
    elevenLabsApiKey: "",
    elevenLabsVoiceId: "",
    elevenLabsToolApiKey: "tool-secret-for-tests-012345678901234567",
    elevenLabsAgentId: "",
    publicBaseUrl: "",
  };
  await data.store.saveElevenLabsAgentId("agent-test");
  const conversationAgent = new ElevenLabsAgentService(
    { ...config, elevenLabsApiKey: "elevenlabs-test-key" },
    data.store,
    async () => Response.json({ signed_url: "wss://api.elevenlabs.io/v1/convai/conversation?token=test" }),
  );
  const app = await createApp({
    config,
    ai: new FakeAi(),
    store: data.store,
    audit: data.audit,
    elevenLabsAgent: conversationAgent,
  });
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
      headers: { authorization: "Bearer coordinator-secret" },
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
    const unauthenticatedTool = await app.inject({
      method: "POST",
      url: "/elevenlabs/tools/questions",
      payload: { sessionId, question: "How often are visits?" },
    });
    assert.equal(unauthenticatedTool.statusCode, 401);
    const access = await app.inject({ method: "GET", url: `/sessions/${sessionId}/conversation-url`, headers: { authorization: "Bearer coordinator-secret" } });
    const sessionAccess = access.json().dynamicVariables.session_access;
    const agentQuestion = await app.inject({
      method: "POST",
      url: "/elevenlabs/tools/questions",
      headers: { authorization: `Bearer ${config.elevenLabsToolApiKey}` },
      payload: { sessionId, sessionAccess, requestId: "voice-question-1", expectedRevision: "0", question: "How often are visits?" },
    });
    assert.equal(agentQuestion.statusCode, 200);
    assert.equal(agentQuestion.json().answer, "The form says visits happen monthly.");
    const agentTeachBack = await app.inject({
      method: "POST",
      url: "/elevenlabs/tools/responses",
      headers: { authorization: `Bearer ${config.elevenLabsToolApiKey}` },
      payload: { sessionId, sessionAccess, requestId: "voice-response-1", expectedRevision: "1", response: "Visits happen monthly." },
    });
    assert.equal(agentTeachBack.statusCode, 200);
    assert.equal(agentTeachBack.json().sessionId, sessionId);
    const conversationUrl = await app.inject({
      method: "GET",
      url: `/sessions/${sessionId}/conversation-url`,
      headers: { authorization: "Bearer coordinator-secret" },
    });
    assert.equal(conversationUrl.statusCode, 200);
    assert.equal(conversationUrl.json().signedUrl, "wss://api.elevenlabs.io/v1/convai/conversation?token=test");
    assert.equal(conversationUrl.json().dynamicVariables.session_id, sessionId);
    assert.equal(
      conversationUrl.json().dynamicVariables.opening_message,
      data.store.getSession(sessionId)?.lastAssistantMessage,
    );
  } finally {
    await app.close();
    await rm(data.directory, { recursive: true, force: true });
  }
});

test("Gemini intent classification uses redacted review context and rejects invalid output", async () => {
  const originalFetch = globalThis.fetch;
  let output: unknown = { intent: "question" };
  let body = "";
  globalThis.fetch = async (_input, init) => {
    body = String(init?.body);
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }] });
  };
  try {
    const ai = new GeminiProvider("test-key", "test-model", "test-embedding");
    const context = {
      section: { id: "purpose", title: "Purpose", text: "Visits are monthly.", embedding: [1, 0] },
      guide: { summary: "Visits are monthly.", question: "Explain the visits in your own words." },
      recentMessages: [{ role: "patient" as const, content: "Contact patient@example.com" }],
    };
    assert.equal(await ai.classifyMessage("Please explain visits; email patient@example.com", context), "question");
    assert.ok(!body.includes("patient@example.com"));
    assert.ok(body.includes("[REDACTED_EMAIL]"));
    assert.ok(body.includes(context.guide.question));
    assert.match(body, /do not rely on punctuation/);
    assert.match(body, /prioritize question/);
    for (const intent of ["response", "clarify"] as const) {
      output = { intent };
      assert.equal(await ai.classifyMessage("A patient message", context), intent);
    }
    output = { intent: "skip" };
    await assert.rejects(ai.classifyMessage("skip this", context), /invalid message intent/);
    output = { intent: true };
    await assert.rejects(ai.classifyMessage("yes", context), /invalid message intent/);
  } finally { globalThis.fetch = originalFetch; }
});
