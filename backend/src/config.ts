import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { HttpError } from "./errors.js";

export interface Config {
  logLevel?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  trustProxy?: string[];
  notificationWebhookUrl?: string;
  notificationWebhookSecret?: string;
  notificationDeliveryEnabled?: boolean;
  bootstrapEmail?: string;
  bootstrapPassword?: string;
  secureCookies?: boolean;
  allowLegacyApiKey?: boolean;
  port: number;
  dataDir: string;
  stateFile: string;
  auditFile: string;
  approvedVersions: Record<string, string[]>;
  coordinatorApiKey: string;
  corsOrigins: string[];
  geminiApiKey: string;
  geminiModel: string;
  geminiTranscriptionModel?: string;
  geminiEmbeddingModel: string;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  elevenLabsToolApiKey: string;
  elevenLabsAgentId: string;
  publicBaseUrl: string;
}

export async function loadConfig(): Promise<Config> {
  const logLevel = process.env.LOG_LEVEL?.trim() || "info";
  if (!["fatal", "error", "warn", "info", "debug", "trace", "silent"].includes(logLevel)) {
    throw new HttpError(500, "LOG_LEVEL must be fatal, error, warn, info, debug, trace or silent");
  }
  const trustProxy = (process.env.TRUST_PROXY ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  const dataDir = resolve(process.env.DATA_DIR ?? "./data");
  const approvedFile = process.env.APPROVED_VERSIONS_FILE;
  const useBundledApprovals = process.env.VERCEL === "1" && approvedFile === undefined;
  let value: unknown;
  try {
    // A literal module-relative URL lets Vercel trace this read-only asset.
    // Explicit overrides always win and fail closed; never fall back on read errors.
    const contents = useBundledApprovals
      ? await readFile(new URL("../data/approved-versions.json", import.meta.url), "utf8")
      : await readFile(resolve(approvedFile ?? `${dataDir}/approved-versions.json`), "utf8");
    value = JSON.parse(contents);
  } catch (error) {
    throw new HttpError(500, `Could not load approved versions file: ${error instanceof Error ? error.message : "invalid file"}`);
  }
  if (
    typeof value !== "object" || value === null || Array.isArray(value) ||
    Object.values(value).some((versions) =>
      !Array.isArray(versions) || versions.some((version) => typeof version !== "string"),
    )
  ) {
    throw new HttpError(500, "Approved versions must map study IDs to arrays of version strings");
  }
  const port = Number(process.env.PORT ?? "3001");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new HttpError(500, "PORT must be an integer between 1 and 65535");
  }
  if (Boolean(process.env.BOOTSTRAP_COORDINATOR_EMAIL?.trim()) !== Boolean(process.env.BOOTSTRAP_COORDINATOR_PASSWORD)) {
    throw new HttpError(500, "Configure both bootstrap coordinator email and password, or neither");
  }
  const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",").map((origin) => origin.trim()).filter(Boolean);
  if (!corsOrigins.length || corsOrigins.some((origin) => {
    try { const url = new URL(origin); return !["http:", "https:"].includes(url.protocol) || url.origin !== origin; }
    catch { return true; }
  })) throw new HttpError(500, "CORS_ORIGIN must contain exact HTTP(S) origins without paths or wildcards");
  const notificationWebhookUrl = process.env.NOTIFICATION_WEBHOOK_URL?.trim() ?? "";
  const notificationWebhookSecret = process.env.NOTIFICATION_WEBHOOK_SECRET ?? "";
  const notificationDeliveryEnabled = process.env.NOTIFICATION_DELIVERY_ENABLED === "true";
  if (notificationWebhookUrl) {
    let valid = false;
    try { const url = new URL(notificationWebhookUrl); valid = url.protocol === "https:" && !url.username && !url.password && !url.hash; } catch { /* Invalid configuration below. */ }
    if (!valid) throw new HttpError(500, "NOTIFICATION_WEBHOOK_URL must be an HTTPS URL without embedded credentials or a fragment");
  }
  if (notificationDeliveryEnabled && (!notificationWebhookUrl || notificationWebhookSecret.length < 32)) throw new HttpError(500, "Enable notification delivery only with an HTTPS webhook and a secret of at least 32 characters");
  return {
    logLevel: logLevel as NonNullable<Config["logLevel"]>,
    trustProxy,
    notificationWebhookUrl, notificationWebhookSecret, notificationDeliveryEnabled,
    bootstrapEmail: process.env.BOOTSTRAP_COORDINATOR_EMAIL?.trim() ?? "",
    bootstrapPassword: process.env.BOOTSTRAP_COORDINATOR_PASSWORD ?? "",
    secureCookies: process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
    allowLegacyApiKey: process.env.ALLOW_LEGACY_API_KEY === "true",
    port,
    dataDir,
    stateFile: resolve(dataDir, "state.json"),
    auditFile: resolve(dataDir, "audit.jsonl"),
    approvedVersions: value as Record<string, string[]>,
    coordinatorApiKey: process.env.COORDINATOR_API_KEY?.trim() ?? "",
    corsOrigins,
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() ?? "",
    geminiModel: process.env.GEMINI_MODEL?.trim() || "gemma-4-26b-a4b-it",
    geminiTranscriptionModel: process.env.GEMINI_TRANSCRIPTION_MODEL?.trim() || "gemini-3.1-flash-lite",
    geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-001",
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY?.trim() ?? "",
    elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID?.trim() ?? "",
    elevenLabsToolApiKey: process.env.ELEVENLABS_TOOL_API_KEY?.trim() ?? "",
    elevenLabsAgentId: process.env.ELEVENLABS_AGENT_ID?.trim() ?? "",
    publicBaseUrl: process.env.PUBLIC_BASE_URL?.trim() ?? "",
  };
}

export function requireGemini(config: Config): { apiKey: string; model: string } {
  if (!config.geminiApiKey) throw new HttpError(503, "GEMINI_API_KEY is not configured");
  return { apiKey: config.geminiApiKey, model: config.geminiModel };
}
