import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { FastifyRequest } from "fastify";
import { HttpError } from "./errors.js";

export interface Config {
  port: number;
  dataDir: string;
  stateFile: string;
  auditFile: string;
  approvedVersions: Record<string, string[]>;
  coordinatorApiKey: string;
  corsOrigins: string[];
  geminiApiKey: string;
  geminiModel: string;
  geminiEmbeddingModel: string;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  elevenLabsToolApiKey: string;
  elevenLabsAgentId: string;
  publicBaseUrl: string;
}

export async function loadConfig(): Promise<Config> {
  const dataDir = resolve(process.env.DATA_DIR ?? "./data");
  const approvedFile = resolve(process.env.APPROVED_VERSIONS_FILE ?? `${dataDir}/approved-versions.json`);
  let value: unknown;
  try {
    value = JSON.parse(await readFile(approvedFile, "utf8"));
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
  return {
    port,
    dataDir,
    stateFile: resolve(dataDir, "state.json"),
    auditFile: resolve(dataDir, "audit.jsonl"),
    approvedVersions: value as Record<string, string[]>,
    coordinatorApiKey: process.env.COORDINATOR_API_KEY?.trim() ?? "",
    corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",").map((origin) => origin.trim()).filter(Boolean),
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() ?? "",
    geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-001",
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY?.trim() ?? "",
    elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID?.trim() ?? "",
    elevenLabsToolApiKey: process.env.ELEVENLABS_TOOL_API_KEY?.trim() ?? "",
    elevenLabsAgentId: process.env.ELEVENLABS_AGENT_ID?.trim() ?? "",
    publicBaseUrl: process.env.PUBLIC_BASE_URL?.trim() ?? "",
  };
}

export function requireCoordinator(request: FastifyRequest, config: Config): void {
  if (!config.coordinatorApiKey) throw new HttpError(503, "Coordinator authentication is not configured");
  const authorization = request.headers.authorization;
  if (authorization !== `Bearer ${config.coordinatorApiKey}`) {
    throw new HttpError(401, "Coordinator authentication required");
  }
}

export function requireGemini(config: Config): { apiKey: string; model: string } {
  if (!config.geminiApiKey) throw new HttpError(503, "GEMINI_API_KEY is not configured");
  return { apiKey: config.geminiApiKey, model: config.geminiModel };
}
