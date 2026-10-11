import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app.js";
import { JsonStore } from "./store.js";
import { ElevenLabsAgentService } from "./elevenlabs-agent.js";
import type { Config } from "./config.js";
import type { AiProvider } from "./types.js";

const origin = "http://localhost:5173";
const ai: AiProvider = {
  async classifyMessage(message) {
    if (message.includes("?") || message.startsWith("Please explain")) return "question";
    if (message === "okay") return "clarify";
    return "response";
  },
  async embed() { return [1, 0]; }, async transcribeAudio() { return "understood"; },
  async createGuide(section, rephrase) { return { summary: `${rephrase ? "Rephrased " : ""}${section.text}`, question: `Explain ${section.title}` }; },
  async grade(_section, response) { return response.startsWith("understood"); },
  async answerQuestion() { return { answer: "Visits are monthly", citations: ["Purpose"], requiresClinician: false }; },
  async verifyAnswer() { return true; },
};
const cookieFrom = (headers: Record<string, unknown>) => String(headers["set-cookie"]).split(";")[0]!;
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "soundconsent-auth-"));
  const config: Config = {
    port: 3001, dataDir: directory, stateFile: join(directory, "state.json"), auditFile: join(directory, "audit.jsonl"),
    approvedVersions: {}, coordinatorApiKey: "legacy-secret", corsOrigins: [origin], secureCookies: true,
    bootstrapEmail: "admin@example.com", bootstrapPassword: "a-long-test-password",
    geminiApiKey: "", geminiModel: "", geminiEmbeddingModel: "", elevenLabsApiKey: "test-key", elevenLabsVoiceId: "",
    elevenLabsToolApiKey: "test-tool-secret-32-characters-long", elevenLabsAgentId: "test-agent", publicBaseUrl: "",
  };
  const store = new JsonStore(config.stateFile); await store.init();
  const save = (studyId: string) => store.saveDocument({ title: `${studyId} consent`, studyId, version: "1", pageCount: 1, uploadedAt: new Date().toISOString(), sections: [
    { id: "purpose", title: "Purpose", text: "Visits are monthly.", embedding: [1, 0] },
    { id: "risks", title: "Risks", text: "There may be discomfort.", embedding: [1, 0] },
  ] });
  const doc = await save("study-a"); const otherDoc = await save("study-b");
  const voice = new ElevenLabsAgentService(config, store, async () => new Response(JSON.stringify({ signed_url: "wss://example.com/voice" }), { headers: { "content-type": "application/json" } }));
  let app = await createApp({ config, store, ai, elevenLabsAgent: voice });
  const login = async (email = "admin@example.com", password = "a-long-test-password") => {
    const response = await app.inject({ method: "POST", url: "/auth/login", headers: { origin }, payload: { email, password } });
    assert.equal(response.statusCode, 200, response.body); return cookieFrom(response.headers);
  };
  const request = (method: "GET" | "POST", url: string, cookie: string, payload?: object) => app.inject({ method, url, headers: { cookie, origin }, ...(payload ? { payload } : {}) });
  return {
    get app() { return app; }, config, store, doc, otherDoc, login, request,
    async restart() { await app.close(); app = await createApp({ config, ai }); },
    async cleanup() { await app.close(); await rm(directory, { recursive: true, force: true }); },
  };
}

test("coordinator cookie auth, CSRF, study scopes, account disabling and legacy default denial", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.app.inject({ method: "GET", url: "/documents", headers: { authorization: "Bearer legacy-secret" } })).statusCode, 401);
    assert.equal((await f.app.inject({ method: "POST", url: "/auth/login", payload: { email: "admin@example.com", password: "wrong" } })).statusCode, 401);
    const login = await f.app.inject({ method: "POST", url: "/auth/login", headers: { origin }, payload: { email: " ADMIN@example.com ", password: "a-long-test-password" } });
    assert.equal(login.statusCode, 200); assert.match(String(login.headers["set-cookie"]), /HttpOnly; SameSite=Strict; Max-Age=28800; Secure/);
    assert.equal(login.json().user.passwordHash, undefined);
    const admin = cookieFrom(login.headers);
    const create = await f.request("POST", "/auth/accounts", admin, { email: "staff@example.com", password: "another-long-password", name: "Staff", role: "coordinator", studyIds: ["study-a"] });
    assert.equal(create.statusCode, 201, create.body);
    // A rejected mutation must not poison the persistence queue.
    assert.equal((await f.request("POST", "/auth/accounts", admin, { email: "staff@example.com", password: "another-long-password", name: "Staff", role: "coordinator", studyIds: [] })).statusCode, 409);
    const staff = await f.login("staff@example.com", "another-long-password");
    const docs = await f.request("GET", "/documents", staff);
    assert.deepEqual(docs.json().documents.map((d: { id: string }) => d.id), [f.doc.id]);
    assert.equal((await f.request("GET", `/documents/${f.otherDoc.id}`, staff)).statusCode, 403);
    const detail = await f.request("GET", `/documents/${f.doc.id}`, staff);
    assert.equal(detail.json().sections[0].text, "Visits are monthly."); assert.equal(detail.json().sections[0].embedding, undefined);
    assert.equal((await f.request("POST", "/sessions", staff, { documentId: f.otherDoc.id })).statusCode, 403);
    assert.equal((await f.request("GET", "/auth/accounts", staff)).statusCode, 403);
    assert.equal((await f.app.inject({ method: "POST", url: "/sessions", headers: { cookie: staff, origin: "https://evil.example" }, payload: { documentId: f.doc.id } })).statusCode, 403);
    assert.equal((await f.app.inject({ method: "POST", url: "/sessions", headers: { cookie: staff }, payload: { documentId: f.doc.id } })).statusCode, 403);
    const own = await f.request("POST", "/sessions", staff, { documentId: f.doc.id }); assert.equal(own.statusCode, 201);
    const other = await f.request("POST", "/sessions", admin, { documentId: f.otherDoc.id });
    assert.equal((await f.request("GET", `/sessions/${other.json().sessionId}`, staff)).statusCode, 403);
    assert.equal((await f.request("GET", `/sessions/${other.json().sessionId}/report`, staff)).statusCode, 403);
    const list = await f.request("GET", "/sessions", staff);
    assert.deepEqual(list.json().sessions.map((s: { sessionId: string }) => s.sessionId), [own.json().sessionId]);
    assert.equal((await f.request("POST", `/auth/accounts/${create.json().user.id}/disable`, admin)).statusCode, 200);
    assert.equal((await f.request("GET", "/auth/me", staff)).statusCode, 401);
    assert.equal((await f.request("POST", "/auth/logout", admin)).statusCode, 200);
    assert.equal((await f.request("GET", "/auth/me", admin)).statusCode, 401);
  } finally { await f.cleanup(); }
});

test("single-use patient access, read/voice boundaries, revocation, expiry and logout", async () => {
  const f = await fixture();
  try {
    const admin = await f.login();
    const started = await f.request("POST", "/sessions", admin, { documentId: f.doc.id });
    const id: string = started.json().sessionId;
    const second = await f.request("POST", "/sessions", admin, { documentId: f.doc.id });
    const otherId: string = second.json().sessionId;
    for (const [method, path] of [["GET", ""], ["POST", "/responses"], ["POST", "/questions"], ["POST", "/audio"], ["POST", "/speech"], ["POST", "/voice-transcript"], ["GET", "/conversation-url"]] as const) {
      assert.equal((await f.app.inject({ method, url: `/sessions/${id}${path}` })).statusCode, 401, path);
    }
    const invite = (await f.request("POST", `/sessions/${id}/invitations`, admin)).json();
    const payload = { invitationToken: invite.invitationToken, accessCode: invite.accessCode };
    const bad = await f.app.inject({ method: "POST", url: `/sessions/${id}/access`, payload: { ...payload, accessCode: "wrong" } }); assert.equal(bad.statusCode, 401);
    const redeemed = await Promise.all([1, 2].map(() => f.app.inject({ method: "POST", url: `/sessions/${id}/access`, headers: { origin }, payload })));
    assert.deepEqual(redeemed.map((r) => r.statusCode).sort(), [200, 401]);
    const patient = cookieFrom(redeemed.find((r) => r.statusCode === 200)!.headers);
    const patientSnapshot = await f.request("GET", `/sessions/${id}`, patient);
    assert.equal(patientSnapshot.statusCode, 200);
    assert.equal(patientSnapshot.json().accessRole, "patient");
    const speech = { id: "spoken-message-1", role: "patient", content: "Email me at test@example.com", timestamp: new Date().toISOString() };
    for (let retry = 0; retry < 2; retry++) assert.equal((await f.request("POST", `/sessions/${id}/voice-transcript`, patient, { messages: [speech] })).statusCode, 200);
    assert.equal((await f.request("POST", `/sessions/${otherId}/voice-transcript`, patient, { messages: [speech] })).statusCode, 401);
    assert.equal((await f.request("POST", `/sessions/${id}/voice-transcript`, patient, { messages: [{ ...speech, role: "system" }] })).statusCode, 400);
    const withSpeech = (await f.request("GET", `/sessions/${id}`, patient)).json();
    assert.equal(withSpeech.voiceTranscript.length, 1);
    assert.ok(!withSpeech.voiceTranscript[0].content.includes("test@example.com"));
    assert.equal(withSpeech.revision, patientSnapshot.json().revision);
    assert.deepEqual(withSpeech.transcript, patientSnapshot.json().transcript);
    assert.equal((await f.request("GET", `/sessions/${id}`, admin)).json().accessRole, "coordinator");
    for (const path of ["/documents", "/sessions", `/sessions/${otherId}`, `/sessions/${id}/report`, "/auth/me"]) assert.equal((await f.request("GET", path, patient)).statusCode, 401, path);
    const voice = await f.request("GET", `/sessions/${id}/conversation-url`, patient);
    assert.equal(voice.statusCode, 200, voice.body);
    const sessionAccess = voice.json().dynamicVariables.session_access;
    const tool = (sessionId: string) => f.app.inject({ method: "POST", url: "/elevenlabs/tools/questions", headers: { authorization: `Bearer ${f.config.elevenLabsToolApiKey}` }, payload: { sessionId, sessionAccess, requestId: "voice-question-1", expectedRevision: "0", question: "When are visits?" } });
    assert.equal((await tool(otherId)).statusCode, 401);
    const firstTool = await tool(id);
    assert.equal(firstTool.statusCode, 200);
    assert.deepEqual((await tool(id)).json(), firstTool.json());
    assert.equal((await f.app.inject({ method: "POST", url: "/elevenlabs/tools/questions", headers: { authorization: `Bearer ${f.config.elevenLabsToolApiKey}` }, payload: { sessionId: id, sessionAccess, question: "When are visits?" } })).statusCode, 400);
    await f.request("POST", `/sessions/${id}/access/revoke`, admin);
    assert.equal((await f.request("GET", `/sessions/${id}`, patient)).statusCode, 401);
    assert.equal((await tool(id)).statusCode, 401);
    const again = (await f.request("POST", `/sessions/${id}/invitations`, admin)).json();
    const exchange = await f.app.inject({ method: "POST", url: `/sessions/${id}/access`, headers: { origin }, payload: { invitationToken: again.invitationToken, accessCode: again.accessCode } });
    const anotherPatient = cookieFrom(exchange.headers);
    assert.equal((await f.request("POST", `/sessions/${id}/logout`, anotherPatient)).statusCode, 200);
    assert.equal((await f.request("GET", `/sessions/${id}`, anotherPatient)).statusCode, 401);
    const expired = (await f.request("POST", `/sessions/${id}/invitations`, admin)).json();
    await f.store.updateAuth((auth) => { for (const invitation of auth.invitations) invitation.expiresAt = 0; });
    assert.equal((await f.app.inject({ method: "POST", url: `/sessions/${id}/access`, payload: { invitationToken: expired.invitationToken, accessCode: expired.accessCode } })).statusCode, 401);
    await f.store.updateAuth((auth) => { for (const grant of auth.grants) grant.expiresAt = 0; });
    assert.equal((await f.request("GET", "/auth/me", admin)).statusCode, 401);
  } finally { await f.cleanup(); }
});

test("resume preserves rephrased guide, redacted transcript, progress and session cookies across restart", async () => {
  const f = await fixture();
  try {
    const admin = await f.login();
    const id: string = (await f.request("POST", "/sessions", admin, { documentId: f.doc.id })).json().sessionId;
    await f.request("POST", `/sessions/${id}/responses`, admin, { response: "unsure; email person@example.com" });
    await f.request("POST", `/sessions/${id}/questions`, admin, { question: "When are visits?" });
    const before = (await f.request("GET", `/sessions/${id}`, admin)).json();
    assert.equal(before.attemptsForCurrentSection, 1);
    assert.match(before.guide.summary, /Rephrased/);
    assert.equal(before.transcript.length, 5);
    assert.equal(before.message, "Visits are monthly");
    assert.ok(JSON.stringify(before).includes("[REDACTED_EMAIL]"));
    assert.ok(!JSON.stringify(before).includes("person@example.com"));
    assert.equal(before.sections[0].embedding, undefined);
    const persisted = await readFile(f.config.stateFile, "utf8");
    assert.ok(!persisted.includes("a-long-test-password")); assert.ok(!persisted.includes(admin.split("=")[1]!));
    const state = JSON.parse(persisted);
    state.documents[0].sections[0].text = "Changed after the review began";
    await writeFile(f.config.stateFile, JSON.stringify(state));
    await f.restart();
    const after = await f.request("GET", `/sessions/${id}`, admin); assert.equal(after.statusCode, 200);
    assert.deepEqual(after.json(), before);
    await f.request("POST", `/sessions/${id}/responses`, admin, { response: "still unsure" });
    const advanced = (await f.request("GET", `/sessions/${id}`, admin)).json();
    assert.equal(advanced.section.index, 2); assert.equal(advanced.results[0].attempts, 2); assert.equal(advanced.sections[0].status, "needs-review");
    await f.request("POST", `/sessions/${id}/responses`, admin, { response: "understood" });
    const complete = (await f.request("GET", `/sessions/${id}`, admin)).json();
    assert.equal(complete.status, "completed"); assert.equal(complete.guide, null); assert.equal(complete.consentObtained, false);
    assert.equal((await f.request("POST", `/sessions/${id}/responses`, admin, { response: "understood" })).statusCode, 409);
    const report = (await f.request("GET", `/sessions/${id}/report`, admin)).json();
    assert.equal(report.sections[0].sectionId, "purpose"); assert.equal(report.completedAt, complete.completedAt);
  } finally { await f.cleanup(); }
});

test("authentication throttles repeated failures", async () => {
  const f = await fixture();
  try {
    for (let attempt = 0; attempt < 10; attempt++) assert.equal((await f.app.inject({ method: "POST", url: "/auth/login", payload: { email: "admin@example.com", password: "wrong" } })).statusCode, 401);
    assert.equal((await f.app.inject({ method: "POST", url: "/auth/login", payload: { email: "admin@example.com", password: "wrong" } })).statusCode, 429);
  } finally { await f.cleanup(); }
});

test("legacy reviews expose available source without inventing prior history", async () => {
  const f = await fixture();
  try {
    const admin = await f.login();
    const id: string = (await f.request("POST", "/sessions", admin, { documentId: f.doc.id })).json().sessionId;
    const legacy = f.store.getSession(id)!;
    delete legacy.transcript; delete legacy.guide; delete legacy.documentSnapshot;
    await f.store.saveSession(legacy);
    const read = (await f.request("GET", `/sessions/${id}`, admin)).json();
    assert.equal(read.historyAvailable, false); assert.deepEqual(read.transcript, []); assert.equal(read.guide, null);
    assert.equal(read.sections[0].text, "Visits are monthly.");
    await f.request("POST", `/sessions/${id}/responses`, admin, { response: "unsure" });
    assert.equal((await f.request("GET", `/sessions/${id}`, admin)).json().historyAvailable, false);
    const malformed = await f.app.inject({ method: "POST", url: "/auth/login", headers: { "content-type": "application/json" }, payload: "{broken" });
    assert.equal(malformed.statusCode, 400); assert.equal(malformed.json().error, "Invalid request");
  } finally { await f.cleanup(); }
});

test("patient accounts keep study access through logout, expiry and restart while isolating patients and staff", async () => {
  const f = await fixture();
  try {
    const admin = await f.login();
    const id = (await f.request("POST", "/sessions", admin, { documentId: f.doc.id })).json().sessionId;
    const otherId = (await f.request("POST", "/sessions", admin, { documentId: f.otherDoc.id })).json().sessionId;
    const register = await f.request("POST", "/patient/register", "", { username: " Patient.One ", password: "patient-long-password", role: "admin" });
    assert.equal(register.statusCode, 201, register.body);
    assert.deepEqual(Object.keys(register.json().user).sort(), ["id", "username"]);
    assert.equal(register.json().user.username, "patient.one");
    let patient = cookieFrom(register.headers);
    assert.match(String(register.headers["set-cookie"]), /HttpOnly; SameSite=Strict; Max-Age=86400; Secure/);
    assert.equal((await f.request("POST", "/patient/register", "", { username: "PATIENT.ONE", password: "patient-long-password" })).statusCode, 409);
    assert.equal((await f.request("POST", "/patient/register", "", { username: "short", password: "short" })).statusCode, 400);
    assert.equal((await f.request("GET", "/patient/studies", patient)).json().studies.length, 0);
    assert.equal((await f.request("POST", `/sessions/${id}/patient-invitation`, patient, { username: "patient.one" })).statusCode, 401);
    assert.equal((await f.request("POST", `/sessions/${id}/patient-invitation`, admin, { username: "PATIENT.ONE" })).statusCode, 201);
    assert.equal((await f.request("POST", `/sessions/${id}/patient-invitation`, admin, { username: "patient.one" })).statusCode, 201);
    assert.equal((await f.request("POST", `/sessions/${id}/invitations`, admin)).statusCode, 409);
    let studies = (await f.request("GET", "/patient/studies", patient)).json().studies;
    assert.equal(studies.length, 1); assert.equal(studies[0].isNew, true); assert.equal(studies[0].studyId, "study-a");
    for (const path of ["/documents", "/sessions", "/auth/me", "/auth/accounts", `/sessions/${id}/report`, `/sessions/${otherId}`]) assert.equal((await f.request("GET", path, patient)).statusCode, 401, path);
    assert.equal((await f.app.inject({ method: "POST", url: `/patient/studies/${id}/open`, headers: { cookie: patient } })).statusCode, 403);
    assert.equal((await f.request("POST", `/patient/studies/${otherId}/open`, patient)).statusCode, 403);
    assert.equal((await f.request("POST", `/patient/studies/${id}/open`, patient)).statusCode, 200);
    assert.equal((await f.request("POST", `/sessions/${id}/responses`, patient, { response: "understood monthly visits" })).statusCode, 200);
    assert.equal((await f.request("GET", `/sessions/${id}`, patient)).json().accessRole, "patient");
    const persisted = await readFile(f.config.stateFile, "utf8");
    assert.ok(!persisted.includes("patient-long-password")); assert.ok(!persisted.includes(patient.split("=")[1]!));
    const second = await f.request("POST", "/patient/register", "", { username: "patient.two", password: "patient-long-password" });
    const another = cookieFrom(second.headers);
    assert.equal((await f.request("POST", `/sessions/${id}/patient-invitation`, admin, { username: "patient.two" })).statusCode, 409);
    assert.equal((await f.request("GET", `/sessions/${id}`, another)).statusCode, 401);
    assert.equal((await f.request("GET", "/patient/studies", another)).json().studies.length, 0);
    await f.store.updateAuth((auth) => { for (const grant of auth.grants) if (grant.kind === "patient_account") grant.expiresAt = 0; });
    assert.equal((await f.request("GET", `/sessions/${id}`, patient)).statusCode, 401);
    assert.equal((await f.request("POST", "/patient/login", "", { username: "patient.one", password: "wrong" })).statusCode, 401);
    const login = await f.request("POST", "/patient/login", "", { username: "PATIENT.ONE", password: "patient-long-password" });
    assert.equal(login.statusCode, 200); patient = cookieFrom(login.headers);
    await f.restart();
    studies = (await f.request("GET", "/patient/studies", patient)).json().studies;
    assert.equal(studies.length, 1); assert.equal(studies[0].isNew, false); assert.equal(studies[0].reviewedSections, 1);
    assert.equal((await f.request("GET", `/sessions/${id}`, patient)).statusCode, 200);
    assert.equal((await f.request("POST", "/patient/logout", patient)).statusCode, 200);
    assert.equal((await f.request("GET", `/sessions/${id}`, patient)).statusCode, 401);
    patient = cookieFrom((await f.request("POST", "/patient/login", "", { username: "patient.one", password: "patient-long-password" })).headers);
    assert.equal((await f.request("GET", `/sessions/${id}`, patient)).statusCode, 200);
    await f.request("POST", `/sessions/${id}/access/revoke`, admin);
    assert.equal((await f.request("GET", `/sessions/${id}`, patient)).statusCode, 401);
    assert.equal((await f.request("GET", "/patient/studies", patient)).json().studies.length, 0);
  } finally { await f.cleanup(); }
});

test("first-time invitations and existing temporary access connect to one patient account", async () => {
  const f = await fixture();
  try {
    const admin = await f.login();
    const id = (await f.request("POST", "/sessions", admin, { documentId: f.doc.id })).json().sessionId;
    const anotherId = (await f.request("POST", "/sessions", admin, { documentId: f.doc.id })).json().sessionId;
    const patient = cookieFrom((await f.request("POST", "/patient/register", "", { username: "invited.patient", password: "patient-long-password" })).headers);
    const stranger = cookieFrom((await f.request("POST", "/patient/register", "", { username: "other.patient", password: "patient-long-password" })).headers);
    assert.equal((await f.request("POST", `/patient/studies/${id}/claim`, `${patient}; ${admin}`)).statusCode, 403);
    const invite = (await f.request("POST", `/sessions/${id}/invitations`, admin)).json();
    assert.equal((await f.request("POST", `/patient/studies/${id}/accept`, "", invite)).statusCode, 401);
    const attempts = await Promise.all([patient, stranger].map((cookie) => f.request("POST", `/patient/studies/${id}/accept`, cookie, invite)));
    assert.deepEqual(attempts.map((r) => r.statusCode).sort(), [200, 401]);
    const winner = attempts[0]!.statusCode === 200 ? patient : stranger;
    assert.equal((await f.request("GET", "/patient/studies", winner)).json().studies[0].sessionId, id);
    assert.equal((await f.request("GET", `/sessions/${id}`, winner)).statusCode, 200);
    const voice = (await f.request("GET", `/sessions/${id}/conversation-url`, winner)).json().dynamicVariables.session_access;
    await f.request("POST", `/sessions/${id}/access/revoke`, admin);
    const revoked = await f.app.inject({ method: "POST", url: "/elevenlabs/tools/questions", headers: { authorization: `Bearer ${f.config.elevenLabsToolApiKey}` }, payload: { sessionId: id, sessionAccess: voice, requestId: "revoked-voice", expectedRevision: "0", question: "When?" } });
    assert.equal(revoked.statusCode, 401);
    const legacyInvite = (await f.request("POST", `/sessions/${anotherId}/invitations`, admin)).json();
    const temporary = cookieFrom((await f.request("POST", `/sessions/${anotherId}/access`, "", legacyInvite)).headers);
    assert.equal((await f.request("POST", `/patient/studies/${anotherId}/claim`, `${patient}; ${temporary}`)).statusCode, 200);
    assert.equal((await f.request("GET", `/sessions/${anotherId}`, temporary)).statusCode, 401);
    assert.equal((await f.request("GET", `/sessions/${anotherId}`, patient)).statusCode, 200);
    assert.equal((await f.request("POST", `/patient/studies/${anotherId}/claim`, `${stranger}; ${temporary}`)).statusCode, 403);
  } finally { await f.cleanup(); }
});
