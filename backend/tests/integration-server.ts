// Isolated browser-test backend. Never loads .env or calls external providers.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.js";
import type { AiProvider } from "../src/types.js";

const directory = await mkdtemp(join(tmpdir(), "soundconsent-browser-"));
const stateFile = join(directory, "state.json");
await writeFile(stateFile, JSON.stringify({ schemaVersion: 1, sessions: [], documents: [{
  id: "integration-document", studyId: "fixture-study", version: "10", title: "Integration Consent", pageCount: 1,
  uploadedAt: new Date().toISOString(), sections: [
    { id: "purpose", title: "Purpose", text: "This study examines monthly study visits.", embedding: [1, 0] },
    { id: "risks", title: "Risks", text: "Visits may cause discomfort. Participation is voluntary.", embedding: [1, 0] },
  ],
}] }));
const ai: AiProvider = {
  async classifyMessage(message) {
    if (message.includes("?") || message.startsWith("Please explain")) return "question";
    if (message === "okay") return "clarify";
    return "response";
  },
  async embed() { return [1, 0]; },
  async transcribeAudio() { return "understood: visits are voluntary"; },
  async createGuide(section, rephrase) { return { summary: `${rephrase ? "Rephrased: " : ""}${section.text}`, question: `What does ${section.title} explain?` }; },
  async grade(_section, response) { return response.startsWith("understood"); },
  async answerQuestion() { return { answer: "Visits are monthly.", citations: ["Purpose"], requiresClinician: false }; },
  async verifyAnswer() { return true; },
};
const app = await createApp({ ai, config: {
  bootstrapEmail: "coordinator@example.com", bootstrapPassword: "integration-password",
  port: 3002, dataDir: directory, stateFile, auditFile: join(directory, "audit.jsonl"),
  approvedVersions: { "fixture-study": ["10", "11"] }, coordinatorApiKey: "integration-key",
  corsOrigins: ["http://127.0.0.1:4174"], geminiApiKey: "", geminiModel: "", geminiEmbeddingModel: "",
  elevenLabsApiKey: "", elevenLabsVoiceId: "", elevenLabsToolApiKey: "", elevenLabsAgentId: "", publicBaseUrl: "",
} });
await app.listen({ host: "127.0.0.1", port: 3002 });
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, async () => {
  await app.close(); await rm(directory, { recursive: true, force: true }); process.exit(0);
});
