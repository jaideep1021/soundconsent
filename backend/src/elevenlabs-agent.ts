import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { Config } from "./config.js";
import { HttpError } from "./errors.js";
import type { JsonStore } from "./store.js";

const API_BASE = "https://api.elevenlabs.io/v1/convai";
const TOOL_NAMES = {
  answer: "teach_it_back_answer_consent_question",
  response: "teach_it_back_submit_teach_back",
} as const;
const AGENT_PROMPT = [
  "You are a voice assistant that helps a participant understand an informed consent form.",
  "You are not a clinician, cannot give medical advice, and cannot obtain or record consent.",
  `For every question about the study, call ${TOOL_NAMES.answer} and base your reply only on its answer or message.`,
  `For every response to a teach-back question, call ${TOOL_NAMES.response} and speak only the returned message.`,
  "The app supplies session access, revision checks, and retry IDs. Supply only the participant words to the tools. Wait for the tool result before replying. If a tool fails, explain that processing failed and suggest ending voice mode and trying the text chat. Do not ask the participant to repeat an answer that was already transcribed, and do not invent a grade or advance the review.",
  "Never invent facts, interpret medical details, decide whether the participant should join, or claim a response passed unless the tool says so.",
  "For emergencies, follow the tool's immediate safety instructions. If a question is unsupported, tell the participant to ask their doctor.",
  "A human study team member must conduct the final consent discussion. The participant may ask for a human at any time.",
].join(" ");

interface ToolConfig {
  type: "client";
  name: string;
  description: string;
  response_timeout_secs: number;
  expects_response: true;
  interruption_mode: "disable_during_tool_and_turn";
  parameters: {
    type: "object";
    required: string[];
    properties: Record<string, { type: "string"; description: string }>;
  };
}

export class ElevenLabsAgentService {
  constructor(
    private readonly config: Config,
    private readonly store: JsonStore,
    private readonly request: typeof fetch = fetch,
  ) {}

  async provision(name = "Teach-It-Back Consent Companion"): Promise<{ agentId: string; updated: boolean }> {
    this.assertApiConfigured();
    const answerToolId = await this.ensureTool(TOOL_NAMES.answer, createClientTool(TOOL_NAMES.answer, "question",
      "Use for every participant question about the study or consent form. The authenticated app returns a source-grounded answer or the required clinician fallback."));
    const responseToolId = await this.ensureTool(TOOL_NAMES.response, createClientTool(TOOL_NAMES.response, "response",
      "Use whenever the participant responds to a teach-back question. The authenticated app processes the response and returns the safe next message."));
    const existingId = this.config.elevenLabsAgentId || this.store.getElevenLabsAgentId();
    const body = {
      name,
      conversation_config: {
        asr: { provider: "scribe_realtime", quality: "high" },
        tts: {
          model_id: "eleven_turbo_v2",
          ...(this.config.elevenLabsVoiceId ? { voice_id: this.config.elevenLabsVoiceId } : {}),
        },
        conversation: {
          max_duration_seconds: 600,
          // WebSocket voice output requires audio events; interruption clears queued speech.
          client_events: ["audio", "interruption", "ping", "conversation_initiation_metadata", "user_transcript", "agent_response", "agent_response_complete", "agent_tool_request", "agent_tool_response", "client_tool_call"],
        },
        agent: {
          first_message: "{{opening_message}}",
          language: "en",
          prompt: {
            prompt: AGENT_PROMPT,
            llm: "gemini-2.5-flash",
            temperature: 0,
            tool_ids: [answerToolId, responseToolId],
            enable_parallel_tool_calls: false,
            ignore_default_personality: true,
          },
        },
      },
      platform_settings: {
        auth: { enable_auth: true },
        privacy: { record_voice: false, delete_audio: true },
      },
    };
    const result = await this.callApi(
      existingId ? `/agents/${encodeURIComponent(existingId)}` : "/agents/create",
      existingId ? "PATCH" : "POST",
      body,
    );
    const agentId = readStringProperty(result, "agent_id");
    if (!agentId) throw new HttpError(502, "ElevenLabs returned an invalid agent ID");
    await this.store.saveElevenLabsAgentId(agentId);
    return { agentId, updated: Boolean(existingId) };
  }

  async getSignedUrl(): Promise<string> {
    this.assertApiConfigured();
    const agentId = this.config.elevenLabsAgentId || this.store.getElevenLabsAgentId();
    if (!agentId) throw new HttpError(503, "Provision the ElevenLabs agent before starting a conversation");
    const result = await this.callApi(
      `/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      "GET",
    );
    const signedUrl = readStringProperty(result, "signed_url");
    if (!signedUrl || !signedUrl.startsWith("wss://")) {
      throw new HttpError(502, "ElevenLabs returned an invalid signed conversation URL");
    }
    return signedUrl;
  }

  private async ensureTool(name: string, toolConfig: ToolConfig): Promise<string> {
    const savedId = this.store.getElevenLabsToolId(name);
    if (savedId) {
      const updated = await this.callApi(`/tools/${encodeURIComponent(savedId)}`, "PATCH", { tool_config: toolConfig });
      const id = readStringProperty(updated, "id");
      if (!id) throw new HttpError(502, "ElevenLabs returned an invalid tool ID");
      return id;
    }

    const found = await this.callApi(`/tools?search=${encodeURIComponent(name)}&page_size=100&created_by_user_id=%40me`, "GET");
    if (isRecord(found) && Array.isArray(found["tools"])) {
      const existing = found["tools"].find((tool) =>
        isRecord(tool) && isRecord(tool["tool_config"]) && tool["tool_config"]["name"] === name && typeof tool["id"] === "string",
      );
      if (isRecord(existing) && typeof existing["id"] === "string") {
        const id = existing["id"];
        const updated = await this.callApi(`/tools/${encodeURIComponent(id)}`, "PATCH", { tool_config: toolConfig });
        const updatedId = readStringProperty(updated, "id");
        if (!updatedId) throw new HttpError(502, "ElevenLabs returned an invalid tool ID");
        await this.store.saveElevenLabsToolId(name, updatedId);
        return updatedId;
      }
    }

    const created = await this.callApi("/tools", "POST", { tool_config: toolConfig });
    const id = readStringProperty(created, "id");
    if (!id) throw new HttpError(502, "ElevenLabs returned an invalid tool ID");
    await this.store.saveElevenLabsToolId(name, id);
    return id;
  }

  private async callApi(path: string, method: "GET" | "POST" | "PATCH", body?: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await this.request(`${API_BASE}${path}`, {
        method,
        headers: {
          "xi-api-key": this.config.elevenLabsApiKey,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new HttpError(502, "ElevenLabs API request failed");
    }
    if (!response.ok) {
      const responseBody = await response.text();
      const detail = summarizeApiError(responseBody, [
        this.config.elevenLabsApiKey,
        this.config.elevenLabsToolApiKey,
      ]);
      throw new HttpError(
        502,
        `ElevenLabs API request failed (${response.status})${detail ? `: ${detail}` : ""}`,
      );
    }
    try {
      return await response.json() as unknown;
    } catch {
      throw new HttpError(502, "ElevenLabs returned an invalid API response");
    }
  }

  private assertApiConfigured(): void {
    if (!this.config.elevenLabsApiKey) throw new HttpError(503, "ELEVENLABS_API_KEY is not configured");
  }
}

export function requireElevenLabsTool(request: FastifyRequest, config: Config): void {
  const expected = config.elevenLabsToolApiKey;
  if (!expected) throw new HttpError(503, "ELEVENLABS_TOOL_API_KEY is not configured");
  const authorization = request.headers.authorization;
  const supplied = typeof authorization === "string" ? authorization : "";
  const expectedDigest = createHash("sha256").update(`Bearer ${expected}`).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  if (!timingSafeEqual(suppliedDigest, expectedDigest)) {
    throw new HttpError(401, "ElevenLabs tool authentication required");
  }
}

function createClientTool(name: string, field: string, description: string): ToolConfig {
  return {
    type: "client", name, description, expects_response: true,
    response_timeout_secs: 120,
    interruption_mode: "disable_during_tool_and_turn",
    parameters: {
      type: "object", required: [field],
      properties: { [field]: { type: "string", description: "The participant's words exactly as spoken. Do not paraphrase or add facts." } },
    },
  };
}

function readStringProperty(value: unknown, property: string): string | undefined {
  return isRecord(value) && typeof value[property] === "string" && value[property]
    ? value[property]
    : undefined;
}

function summarizeApiError(body: string, secrets: string[]): string {
  let summary = body;
  try {
    const parsed: unknown = JSON.parse(body);
    if (isRecord(parsed) && Array.isArray(parsed["detail"])) {
      summary = parsed["detail"].map((entry) => {
        if (!isRecord(entry)) return "";
        const location = Array.isArray(entry["loc"])
          ? entry["loc"].filter((part) => typeof part === "string" || typeof part === "number").join(".")
          : "";
        const message = typeof entry["msg"] === "string" ? entry["msg"] : "";
        return [location, message].filter(Boolean).join(": ");
      }).filter(Boolean).join("; ");
    } else if (isRecord(parsed) && typeof parsed["detail"] === "string") {
      summary = parsed["detail"];
    } else if (isRecord(parsed) && typeof parsed["message"] === "string") {
      summary = parsed["message"];
    }
  } catch {
    // Keep a short non-JSON provider error body for diagnostics.
  }
  for (const secret of secrets) {
    if (secret) summary = summary.replaceAll(secret, "[REDACTED]");
  }
  return summary.replace(/\s+/g, " ").trim().slice(0, 800);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
