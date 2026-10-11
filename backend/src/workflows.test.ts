import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuditLog } from "./audit.js";
import { WorkflowService } from "./workflows.js";
import { NotificationService } from "./notifications.js";
import { createApp } from "./app.js";
import { JsonStore } from "./store.js";
import type { Config } from "./config.js";
import type { AiProvider } from "./types.js";

const origin = "http://localhost:5173";
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "soundconsent-workflow-"));
  let grades = 0; let transcriptions = 0; let embeddings = 0;
  const ai: AiProvider = {
    async embed() { embeddings++; return [1, 0]; }, async transcribeAudio() { transcriptions++; return "understood"; },
    async createGuide(s) { return { summary: s.text, question: "Explain this section" }; },
    async grade(_s, response) { grades++; return response.startsWith("understood"); },
    async answerQuestion() { return { answer: "Please ask your doctor.", citations: [], requiresClinician: true }; }, async verifyAnswer() { return true; },
  };
  const config: Config = { port: 3001, dataDir: directory, stateFile: join(directory, "state.json"), auditFile: join(directory, "audit.jsonl"), approvedVersions: { study: ["1", "2"] }, coordinatorApiKey: "", corsOrigins: [origin], bootstrapEmail: "admin@example.com", bootstrapPassword: "integration-password", geminiApiKey: "", geminiModel: "", geminiEmbeddingModel: "", elevenLabsApiKey: "", elevenLabsVoiceId: "", elevenLabsToolApiKey: "test-tool", elevenLabsAgentId: "", publicBaseUrl: "" };
  const store = new JsonStore(config.stateFile); await store.init();
  const doc = await store.saveDocument({ title: "Consent", studyId: "study", version: "1", pageCount: 1, uploadedAt: new Date().toISOString(), sections: ["Purpose", "Risks"].map((title) => ({ id: title, title, text: `${title} study source`, embedding: [1, 0] })) });
  let app = await createApp({ config, ai, store });
  const login = await app.inject({ method: "POST", url: "/auth/login", headers: { origin }, payload: { email: "admin@example.com", password: "integration-password" } });
  const cookie = String(login.headers["set-cookie"]).split(";")[0]!;
  const request = (method: "GET" | "POST", url: string, payload?: object, headers: Record<string, string> = {}) => app.inject({ method, url, headers: { cookie, origin, ...headers }, ...(payload ? { payload } : {}) });
  const start = async (documentId = doc.id, key = "") => { const r = await request("POST", "/sessions", { documentId }, key ? { "idempotency-key": key } : {}); assert.equal(r.statusCode, 201, r.body); return r.json().sessionId as string; };
  const patient = async (id: string) => { const invite = (await request("POST", `/sessions/${id}/invitations`)).json(); const r = await request("POST", `/sessions/${id}/access`, invite, { cookie: "" }); assert.equal(r.statusCode, 200, r.body); return { cookie: String(r.headers["set-cookie"]).split(";")[0]! }; };
  return { get app() { return app; }, request, start, patient, doc, store, config, get counts() { return { grades, embeddings, transcriptions }; }, async restart() { await app.close(); app = await createApp({ config, ai }); }, async cleanup() { await app.close(); await rm(directory, { recursive: true, force: true }); } };
}

test("durable request replay, concurrent duplicate exclusion, revision conflicts and audio replay", async () => {
  const f = await fixture(); try {
    const [id, again] = await Promise.all([f.start(undefined, "start-key-1"), f.start(undefined, "start-key-1")]); assert.equal(id, again);
    const url = `/sessions/${id}/responses`; const headers = { "idempotency-key": "answer-key-1", "if-match": "0" };
    const results = await Promise.all([f.request("POST", url, { response: "understood" }, headers), f.request("POST", url, { response: "understood" }, headers)]);
    results.forEach((r) => assert.equal(r.statusCode, 200, r.body)); assert.deepEqual(results[0]!.json(), results[1]!.json()); assert.equal(f.counts.grades, 1);
    assert.equal((await f.request("POST", url, { response: "different" }, headers)).statusCode, 409);
    assert.equal((await f.request("POST", url, { response: "understood" }, { "idempotency-key": "answer-key-2", "if-match": "0" })).statusCode, 409);
    await f.restart(); assert.deepEqual((await f.request("POST", url, { response: "understood" }, headers)).json(), results[0]!.json()); assert.equal(f.counts.grades, 1);
    const audio = async () => f.app.inject({ method: "POST", url: `/sessions/${id}/audio`, headers: { origin, ...(await f.patient(id)), "idempotency-key": "audio-key-1", "if-match": "1", "content-type": "multipart/form-data; boundary=test" }, payload: Buffer.from('--test\r\nContent-Disposition: form-data; name="file"; filename="a.wav"\r\nContent-Type: audio/wav\r\n\r\nfixture\r\n--test--\r\n') });
    const first = await audio(); assert.equal(first.statusCode, 200, first.body); const second = await audio(); assert.deepEqual(second.json(), first.json()); assert.equal(f.counts.transcriptions, 1); assert.equal(f.counts.grades, 2);
  } finally { await f.cleanup(); }
});

test("draft editing, explicit approved publication, stale saves, archive and immutable existing reviews", async () => {
  const f = await fixture(); try {
    const id = await f.start();
    const draft = (await f.request("POST", `/documents/${f.doc.id}/draft`, { version: "2" })).json();
    assert.equal(draft.lifecycle, "draft"); assert.equal(draft.sections[0].embedding, undefined);
    assert.equal((await f.request("POST", "/sessions", { documentId: draft.id })).statusCode, 409);
    const edit = { revision: 0, title: "Updated consent", sections: [{ title: "Updated", text: "New approved source" }] };
    assert.equal((await f.request("POST", `/documents/${draft.id}/edit`, edit)).statusCode, 200);
    assert.equal((await f.request("POST", `/documents/${draft.id}/edit`, edit)).statusCode, 409);
    assert.equal((await f.request("POST", `/documents/${draft.id}/publish`, { revision: 1 })).statusCode, 200); assert.equal(f.counts.embeddings, 1);
    const newId = await f.start(draft.id); assert.equal((await f.request("GET", `/sessions/${newId}`)).json().sections[0].text, "New approved source");
    assert.equal((await f.request("POST", `/documents/${draft.id}/edit`, { ...edit, revision: 2 })).statusCode, 409);
    assert.equal((await f.request("POST", `/documents/${draft.id}/archive`, { revision: 2 })).statusCode, 200);
    assert.equal((await f.request("POST", "/sessions", { documentId: draft.id })).statusCode, 409);
    assert.equal((await f.request("GET", `/sessions/${id}`)).json().sections[0].text, "Purpose study source");
    assert.equal((await f.request("GET", `/sessions/${newId}`)).json().sections[0].text, "New approved source");
    const unapproved = (await f.request("POST", `/documents/${draft.id}/draft`, { version: "999" })).json();
    assert.equal((await f.request("POST", `/documents/${unapproved.id}/publish`, { revision: 0 })).statusCode, 409);
    await f.restart(); assert.equal((await f.request("GET", `/documents/${draft.id}`)).json().lifecycle, "archived");
  } finally { await f.cleanup(); }
});

test("persistent scoped follow-ups, resolution history, inbox and settings snapshots", async () => {
  const f = await fixture(); try {
    const old = await f.start();
    const settings = { revision: 0, maxAttempts: 1, reminderDays: 3, notificationsEnabled: true };
    assert.equal((await f.request("POST", "/studies/study/settings", settings)).statusCode, 200);
    assert.equal((await f.request("POST", "/studies/study/settings", settings)).statusCode, 409);
    assert.equal((await f.request("GET", `/sessions/${old}`)).json().maxAttempts, 2);
    const id = await f.start(); await f.request("POST", `/sessions/${id}/responses`, { response: "unsure" });
    const read = (await f.request("GET", `/sessions/${id}/follow-ups`)).json(); const flag = read.flags[0]; assert.equal(flag.status, "open");
    const update = { ...flag, status: "acknowledged", assigneeId: read.assignees[0].id, dueAt: "2020-01-01T00:00:00.000Z", note: "Will review" };
    assert.equal((await f.request("POST", `/sessions/${id}/follow-ups`, update)).statusCode, 200);
    assert.equal((await f.request("POST", `/sessions/${id}/follow-ups`, update)).statusCode, 409);
    const inbox = (await f.request("GET", "/notifications")).json().notifications; assert.equal(inbox[0].overdue, true);
    assert.equal((await f.request("POST", `/sessions/${id}/follow-ups`, { ...update, revision: 1, status: "resolved", note: "" })).statusCode, 400);
    assert.equal((await f.request("POST", `/sessions/${id}/follow-ups`, { ...update, revision: 1, status: "resolved", note: "Discussed. test@example.com" })).statusCode, 200);
    assert.equal((await f.request("GET", "/notifications")).json().notifications.length, 0);
    const patient = await f.patient(id); assert.equal((await f.request("GET", `/sessions/${id}/follow-ups`, undefined, patient)).statusCode, 401);
    assert.equal((await f.request("POST", "/studies/study/settings", { ...settings, revision: 1 }, patient)).statusCode, 401);
    await f.restart(); const report = (await f.request("GET", `/sessions/${id}/report`)).json(); assert.equal(report.followUps[0].history.length, 2); assert.match(report.followUps[0].history[1].note, /REDACTED_EMAIL/); assert.equal(report.sections[0].outcome, "needs_human_follow_up"); assert.equal(report.consentObtained, false);
    const manual = await f.request("POST", `/sessions/${id}/flags`, { description: "Arrange a follow-up conversation" }); assert.equal(manual.statusCode, 201, manual.body);
    assert.equal((await f.request("POST", `/sessions/${id}/flags`, { description: "Unauthorized" }, patient)).statusCode, 401);
    assert.equal((await f.request("GET", `/sessions/${id}/report`)).json().manualFlags[0].description, "Arrange a follow-up conversation");
  } finally { await f.cleanup(); }
});

test("only participant can acknowledge a completed review, once, with consent remaining false", async () => {
  const f = await fixture(); try {
    const id = await f.start(); const patient = await f.patient(id); const url = `/sessions/${id}/acknowledgment`;
    assert.equal((await f.request("POST", url, { accepted: true }, patient)).statusCode, 409);
    await f.request("POST", `/sessions/${id}/responses`, { response: "understood" }); await f.request("POST", `/sessions/${id}/responses`, { response: "understood" });
    assert.equal((await f.request("POST", url, { accepted: true })).statusCode, 403);
    assert.equal((await f.request("POST", url, { accepted: false }, patient)).statusCode, 400);
    const first = await f.request("POST", url, { accepted: true }, patient); assert.equal(first.statusCode, 200, first.body); assert.equal(first.json().acknowledgment.actor, "patient");
    await f.restart(); const second = await f.request("POST", url, { accepted: true }, patient); assert.deepEqual(second.json().acknowledgment, first.json().acknowledgment);
    const report = (await f.request("GET", `/sessions/${id}/report`)).json(); assert.deepEqual(report.acknowledgment, first.json().acknowledgment); assert.equal(report.consentObtained, false);
  } finally { await f.cleanup(); }
});


test("notification outbox is opt-in, deduplicated, retryable, durable and cancels resolved work", async () => {
  const f = await fixture(); try {
    const id = await f.start(); await f.request("POST", `/sessions/${id}/questions`, { question: "I need a human" });
    const audit = new AuditLog(join(f.config.dataDir, "delivery-audit.jsonl")); await audit.init();
    const workflows = new WorkflowService(f.store, audit);
    const session = f.store.getSession(id)!;
    let calls = 0; const keys: string[] = []; let fail = true;
    const transport: typeof fetch = async (_url, init) => { calls++; const headers = init?.headers as Record<string, string>; keys.push(headers["Idempotency-Key"]!); const body = JSON.parse(String(init?.body)); assert.equal(body.description, undefined); assert.equal(body.question, undefined); assert.equal(body.sessionId, id); return new Response(null, { status: fail ? 503 : 204 }); };
    const disabled = new NotificationService(f.store, workflows, audit, f.config, transport);
    await assert.rejects(disabled.enqueue(session, "question:0"), /not configured/); await disabled.tick(); assert.equal(calls, 0);
    const service = new NotificationService(f.store, workflows, audit, { ...f.config, notificationDeliveryEnabled: true, notificationWebhookUrl: "https://relay.example.com/hooks", notificationWebhookSecret: "a-secret-of-at-least-32-characters" }, transport);
    const first = await service.enqueue(session, "question:0"); const second = await service.enqueue(session, "question:0"); assert.equal(first.id, second.id); assert.equal(f.store.notifications().length, 1);
    await Promise.all([service.tick(), service.tick()]); assert.equal(calls, 1); assert.equal(f.store.notifications()[0]!.status, "pending"); assert.equal(f.store.notifications()[0]!.attempts, 1);
    fail = false; await f.store.updateNotification(first.id, (n) => { n.nextAttemptAt = "2000-01-01T00:00:00.000Z"; }); await service.tick(); assert.equal(calls, 2); assert.equal(keys[0], keys[1]); assert.equal(f.store.notifications()[0]!.status, "delivered");
    const flag = workflows.read(session)[0]!;
    await workflows.update(session, "test-actor", { ...flag, status: "acknowledged", dueAt: "2000-01-01T00:00:00.000Z", note: "Scheduled" });
    await service.tick(); assert.equal(calls, 3); await service.tick(); assert.equal(calls, 3); // One due reminder per flag revision.
    const queued = await service.enqueue(session, "question:0");
    const updated = workflows.read(session)[0]!;
    await workflows.update(session, "test-actor", { ...updated, status: "resolved", note: "Discussed" });
    await service.tick(); assert.equal(calls, 3); assert.equal(f.store.notifications().find((n) => n.id === queued.id)!.status, "cancelled");
    const reloaded = new JsonStore(f.config.stateFile); await reloaded.init(); assert.equal(reloaded.notifications()[0]!.status, "delivered");
    await f.request("POST", `/sessions/${id}/questions`, { question: "Please call a nurse" });
    const retryItem = await service.enqueue(f.store.getSession(id)!, "question:1");
    fail = true;
    for (let attempt = 0; attempt < 5; attempt++) { await f.store.updateNotification(retryItem.id, (n) => { n.nextAttemptAt = "2000-01-01T00:00:00.000Z"; }); await service.tick(); }
    assert.equal(f.store.notifications().find((n) => n.id === retryItem.id)!.status, "failed");
    const beforeRetry = calls; await service.tick(); assert.equal(calls, beforeRetry);
    await service.retry(retryItem.id); fail = false; await service.tick(); assert.equal(calls, beforeRetry + 1); assert.equal(keys.at(-1), retryItem.id);
    assert.equal(f.store.notifications().find((n) => n.id === retryItem.id)!.status, "delivered");
  } finally { await f.cleanup(); }
});

test("new coordinator routes enforce study and administrator boundaries", async () => {
  const f = await fixture(); try {
    const id = await f.start();
    await f.request("POST", "/auth/accounts", { name: "Other staff", email: "staff@example.com", password: "long-staff-password", role: "coordinator", studyIds: ["other"] });
    const login = await f.app.inject({ method: "POST", url: "/auth/login", headers: { origin }, payload: { email: "staff@example.com", password: "long-staff-password" } });
    const headers = { cookie: String(login.headers["set-cookie"]).split(";")[0]! };
    for (const [method, url, payload] of [
      ["POST", `/documents/${f.doc.id}/draft`, { version: "2" }],
      ["POST", `/documents/${f.doc.id}/archive`, { revision: 0 }],
      ["GET", `/sessions/${id}/follow-ups`, undefined],
      ["POST", `/sessions/${id}/follow-ups`, {}],
      ["POST", `/sessions/${id}/notifications`, {}],
      ["GET", "/studies/study/settings", undefined],
      ["POST", "/studies/other/settings", { revision: 0, maxAttempts: 2, reminderDays: 7, notificationsEnabled: true }],
    ] as const) assert.equal((await f.request(method, url, payload, headers)).statusCode, 403, url);
    assert.equal((await f.request("GET", "/notifications", undefined, headers)).json().notifications.length, 0);
    assert.equal((await f.request("GET", "/notifications/delivery", undefined, headers)).json().deliveries.length, 0);
    const other = await f.store.saveDocument({ ...f.doc, studyId: "other" });
    const draft = (await f.request("POST", `/documents/${other.id}/draft`, { version: "2" }, headers)).json();
    assert.equal((await f.request("POST", `/documents/${draft.id}/publish`, { revision: 0 }, headers)).statusCode, 403);
    assert.equal((await f.request("POST", "/studies/__proto__/settings", { revision: 0, maxAttempts: 3, reminderDays: 5, notificationsEnabled: true })).statusCode, 200);
    assert.equal((await f.request("GET", "/studies/__proto__/settings")).json().maxAttempts, 3);
    assert.equal((await f.request("GET", "/studies/unrelated/settings")).json().maxAttempts, 2);
  } finally { await f.cleanup(); }
});
