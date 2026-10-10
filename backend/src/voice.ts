import { createHmac } from "node:crypto";
import { Readable } from "node:stream";
import { HttpError } from "./errors.js";
import type { Config } from "./config.js";
import type { AuditLog } from "./audit.js";
import type { JsonStore } from "./store.js";
import type { SessionService } from "./sessions.js";

export async function transcribeAudio(
  config: Config,
  sessionId: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  if (!config.deepgramApiKey) throw new HttpError(503, "DEEPGRAM_API_KEY is not configured");
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new HttpError(413, "Audio must be between 1 byte and 10 MiB");
  if (!/^audio\/[a-z0-9.+-]+$/i.test(contentType)) throw new HttpError(415, "Upload must have an audio content type");
  const response = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true", {
    method: "POST",
    headers: { authorization: `Token ${config.deepgramApiKey}`, "content-type": contentType },
    body: new Uint8Array(bytes),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new HttpError(502, `Deepgram transcription failed (${response.status})`);
  const payload: unknown = await response.json();
  const transcript = getTranscript(payload).trim();
  if (!transcript) throw new HttpError(422, "No speech was recognized in the audio");
  return transcript;
}

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

export function createLiveKitToken(config: Config, sessionId: string): { url: string; token: string } {
  if (!config.liveKitUrl || !config.liveKitApiKey || !config.liveKitApiSecret) {
    throw new HttpError(503, "LiveKit is not configured");
  }
  const now = Math.floor(Date.now() / 1000);
  const room = `consent-${sessionId}`;
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encodeBase64Url(JSON.stringify({
    iss: config.liveKitApiKey,
    sub: `patient-${sessionId}`,
    nbf: now,
    exp: now + 15 * 60,
    video: { roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: true },
  }));
  const body = `${header}.${payload}`;
  const signature = createHmac("sha256", config.liveKitApiSecret).update(body).digest("base64url");
  return { url: config.liveKitUrl, token: `${body}.${signature}` };
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function getTranscript(payload: unknown): string {
  if (typeof payload !== "object" || payload === null || !("results" in payload)) return "";
  const results = payload.results;
  if (typeof results !== "object" || results === null || !("channels" in results) || !Array.isArray(results.channels)) return "";
  const first = results.channels[0];
  if (typeof first !== "object" || first === null || !("alternatives" in first) || !Array.isArray(first.alternatives)) return "";
  const alternative = first.alternatives[0];
  return typeof alternative === "object" && alternative !== null && "transcript" in alternative &&
    typeof alternative.transcript === "string" ? alternative.transcript : "";
}

export async function audioResponse(
  config: Config,
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
  const transcript = await transcribeAudio(config, sessionId, bytes, contentType);
  await audit.append("voice.transcribed", { transcript }, sessionId);
  return sessions.respond(sessionId, transcript);
}
