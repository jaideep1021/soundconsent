import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import type { Config } from "./config.js";
import { requireCoordinator } from "./config.js";
import { HttpError } from "./errors.js";
import { GeminiProvider } from "./gemini.js";
import { DocumentService } from "./documents.js";
import { SessionService } from "./sessions.js";
import { AuditLog } from "./audit.js";
import { JsonStore } from "./store.js";
import { audioResponse, synthesizeSpeech } from "./voice.js";
import { ElevenLabsAgentService, requireElevenLabsTool } from "./elevenlabs-agent.js";
import type { AiProvider } from "./types.js";

export interface AppOptions {
  config: Config;
  ai?: AiProvider;
  store?: JsonStore;
  audit?: AuditLog;
  elevenLabsAgent?: ElevenLabsAgentService;
}

export async function createApp(options: AppOptions): Promise<FastifyInstance> {
  const { config } = options;
  const app = Fastify({ logger: false, bodyLimit: 21 * 1024 * 1024 });
  await app.register(cors, { origin: config.corsOrigins, methods: ["GET", "POST"] });
  await app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 5 },
  });
  const store = options.store ?? new JsonStore(config.stateFile);
  const audit = options.audit ?? new AuditLog(config.auditFile);
  await store.init();
  await audit.init();
  const ai = options.ai ?? new GeminiProvider(config.geminiApiKey, config.geminiModel, config.geminiEmbeddingModel);
  const documents = new DocumentService(store, audit, ai, config.approvedVersions);
  const sessions = new SessionService(store, audit, ai);
  const elevenLabsAgent = options.elevenLabsAgent ?? new ElevenLabsAgentService(config, store);

  app.setErrorHandler((error, _request, reply) => {
    const status = error instanceof HttpError ? error.statusCode
      : isTooLargeError(error) ? 413
      : 500;
    const message = error instanceof HttpError ? error.message
      : status === 413 ? "Request body is too large"
      : "Internal server error";
    if (status >= 500) app.log.error({ err: error instanceof Error ? error : new Error(String(error)) });
    return reply.code(status).send({ error: message });
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/agents/provision", async (request) => {
    requireCoordinator(request, config);
    return elevenLabsAgent.provision();
  });

  app.get<{ Params: { id: string } }>("/sessions/:id/conversation-url", async (request) => {
    const session = store.getSession(request.params.id);
    if (!session) throw new HttpError(404, "Session not found");
    const signedUrl = await elevenLabsAgent.getSignedUrl();
    return {
      signedUrl,
      dynamicVariables: {
        session_id: session.id,
        opening_message: session.lastAssistantMessage,
      },
    };
  });

  app.post<{ Body: { sessionId?: unknown; question?: unknown } }>("/elevenlabs/tools/questions", async (request) => {
    requireElevenLabsTool(request, config);
    const { sessionId, question } = request.body ?? {};
    if (typeof sessionId !== "string" || !sessionId.trim()) throw new HttpError(400, "sessionId is required");
    if (typeof question !== "string") throw new HttpError(400, "question is required");
    return sessions.ask(sessionId, question);
  });

  app.post<{ Body: { sessionId?: unknown; response?: unknown } }>("/elevenlabs/tools/responses", async (request) => {
    requireElevenLabsTool(request, config);
    const { sessionId, response } = request.body ?? {};
    if (typeof sessionId !== "string" || !sessionId.trim()) throw new HttpError(400, "sessionId is required");
    if (typeof response !== "string") throw new HttpError(400, "response is required");
    return sessions.respond(sessionId, response);
  });

  app.post("/documents", async (request, reply) => {
    requireCoordinator(request, config);
    const fields: Record<string, string> = {};
    let upload: { bytes: Buffer; filename: string; mimeType: string } | undefined;
    for await (const part of request.parts()) {
      if (part.type === "file") {
        if (part.fieldname !== "file" || upload) throw new HttpError(400, "Provide one PDF in the file field");
        const bytes = await part.toBuffer();
        if (part.file.truncated) throw new HttpError(413, "PDF exceeds the 20 MiB upload limit");
        upload = { bytes, filename: part.filename, mimeType: part.mimetype };
      } else {
        if (!["studyId", "version"].includes(part.fieldname)) throw new HttpError(400, `Unexpected field: ${part.fieldname}`);
        fields[part.fieldname] = String(part.value);
      }
    }
    if (!upload) throw new HttpError(400, "PDF file is required");
    if (!fields.studyId) throw new HttpError(400, "studyId is required");
    const document = await documents.ingest({
      ...upload,
      studyId: fields.studyId,
      ...(fields.version ? { declaredVersion: fields.version } : {}),
    });
    return reply.code(201).send({
      id: document.id,
      studyId: document.studyId,
      version: document.version,
      title: document.title,
      pageCount: document.pageCount,
      sections: document.sections.map(({ id, title }) => ({ id, title })),
    });
  });

  app.post<{ Body: { documentId?: unknown } }>("/sessions", async (request, reply) => {
    requireCoordinator(request, config);
    const documentId = request.body?.documentId;
    if (typeof documentId !== "string" || !documentId.trim()) throw new HttpError(400, "documentId is required");
    const document = store.getDocument(documentId);
    if (!document) throw new HttpError(404, "Consent document not found");
    const result = await sessions.start(document);
    return reply.code(201).send({
      sessionId: result.session.id,
      status: result.session.status,
      disclosure: result.message.split("\n\n")[0],
      message: result.message,
      section: result.section,
    });
  });

  app.post<{ Params: { id: string }; Body: { response?: unknown } }>("/sessions/:id/responses", async (request) => {
    const response = request.body?.response;
    if (typeof response !== "string") throw new HttpError(400, "response is required");
    return sessions.respond(request.params.id, response);
  });

  app.post<{ Params: { id: string }; Body: { question?: unknown } }>("/sessions/:id/questions", async (request) => {
    const question = request.body?.question;
    if (typeof question !== "string") throw new HttpError(400, "question is required");
    return sessions.ask(request.params.id, question);
  });

  app.get<{ Params: { id: string } }>("/sessions/:id/report", async (request) => {
    requireCoordinator(request, config);
    return sessions.report(request.params.id);
  });

  app.post<{ Params: { id: string } }>("/sessions/:id/audio", async (request) => {
    const part = await request.file();
    if (!part) throw new HttpError(400, "Audio file is required");
    if (part.fieldname !== "file") throw new HttpError(400, "Audio must use the file field");
    const bytes = await part.toBuffer();
    if (part.file.truncated) throw new HttpError(413, "Audio exceeds the 10 MiB limit");
    return audioResponse(ai, request.params.id, store, sessions, audit, bytes, part.mimetype);
  });

  app.post<{ Params: { id: string } }>("/sessions/:id/speech", async (request, reply) => {
    const session = store.getSession(request.params.id);
    if (!session) throw new HttpError(404, "Session not found");
    const audio = await synthesizeSpeech(config, session.lastAssistantMessage);
    await audit.append("voice.synthesized", { characters: session.lastAssistantMessage.length }, session.id);
    return reply.type("audio/mpeg").send(audio);
  });

  return app;
}

function isTooLargeError(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "statusCode" in error && error.statusCode === 413;
}
