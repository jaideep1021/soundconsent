import { Readable } from "node:stream";
import { HttpError } from "./errors.js";
import type { Config } from "./config.js";
import type { AuditLog } from "./audit.js";
import type { JsonStore } from "./store.js";
import type { SessionService } from "./sessions.js";
import type { AiProvider } from "./types.js";

export async function synthesizeSpeech(config: Config, text: string): Promise<Readable> {
  if (!config.elevenLabsApiKey || !config.elevenLabsVoiceId) {
    throw new HttpError(503, "ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID are required");
  }
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.elevenLabsVoiceId)}/stream?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": config.elevenLabsApiKey,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) throw new HttpError(502, `ElevenLabs synthesis failed (${response.status})`);
  if (!response.body) throw new HttpError(502, "ElevenLabs returned an empty audio stream");
  const reader = response.body.getReader();
  return Readable.from((async function* () {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield Buffer.from(value);
      }
    } finally {
      reader.releaseLock();
    }
  })());
}

export async function audioResponse(
  ai: AiProvider,
  sessionId: string,
  store: JsonStore,
  sessions: SessionService,
  audit: AuditLog,
  bytes: Buffer,
  contentType: string,
): Promise<Record<string, unknown>> {
  const session = store.getSession(sessionId);
  if (!session) throw new HttpError(404, "Session not found");
  if (session.status !== "in_progress") throw new HttpError(409, "Session is already complete");
  const transcript = await ai.transcribeAudio(bytes, contentType);
  await audit.append("voice.transcribed", { transcript }, sessionId);
  return sessions.respond(sessionId, transcript);
}
