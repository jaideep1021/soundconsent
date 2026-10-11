import Fastify, { type FastifyRequest, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import type { Config } from "./config.js";
import { AuthService } from "./auth.js";
import { HttpError } from "./errors.js";
import { GeminiProvider } from "./gemini.js";
import { DocumentService } from "./documents.js";
import { SessionService } from "./sessions.js";
import { AuditLog } from "./audit.js";
import { JsonStore } from "./store.js";
import { synthesizeSpeech } from "./voice.js";
import { ElevenLabsAgentService, requireElevenLabsTool } from "./elevenlabs-agent.js";
import { NotificationService } from "./notifications.js";
import { WorkflowService } from "./workflows.js";
import type { AiProvider, MutationOptions } from "./types.js";

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
  await app.register(cors, { origin: config.corsOrigins, methods: ["GET", "POST"], credentials: true });
  await app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 5 },
  });
  const store = options.store ?? new JsonStore(config.stateFile);
  const audit = options.audit ?? new AuditLog(config.auditFile);
  await store.init();
  await audit.init();
  const auth = new AuthService(store, config);
  await auth.init();
  const ai = options.ai ?? new GeminiProvider(config.geminiApiKey, config.geminiModel, config.geminiEmbeddingModel);
  const documents = new DocumentService(store, audit, ai, config.approvedVersions);
  const sessions = new SessionService(store, audit, ai);
  const workflows = new WorkflowService(store, audit);
  const notifications = new NotificationService(store, workflows, audit, config);
  let notificationTimer: ReturnType<typeof setInterval> | undefined;
  app.addHook("onReady", async () => {
    if (notifications.enabled) {
      notificationTimer = setInterval(() => { void notifications.tick().catch((error: unknown) => app.log.error(error)); }, 60000);
      notificationTimer.unref();
    }
  });
  app.addHook("onClose", async () => { if (notificationTimer) clearInterval(notificationTimer); await notifications.close(); });
  const elevenLabsAgent = options.elevenLabsAgent ?? new ElevenLabsAgentService(config, store);

  app.setErrorHandler((error, _request, reply) => {
    const status = error instanceof HttpError ? error.statusCode
      : clientErrorStatus(error) ?? 500;
    const message = error instanceof HttpError ? error.message
      : status === 413 ? "Request body is too large"
      : status < 500 ? "Invalid request" : "Internal server error";
    if (status >= 500) app.log.error({ err: error instanceof Error ? error : new Error(String(error)) });
    return reply.code(status).send({ error: message });
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    reply.header("Referrer-Policy", "no-referrer");
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) auth.checkOrigin(request);
  });

  app.post<{ Body: { email?: unknown; password?: unknown } }>("/auth/login", async (request, reply) => {
    const result = await auth.login(request, reply, request.body?.email, request.body?.password);
    await audit.append("auth.login", { accountId: result.user.id });
    return result;
  });
  app.get("/auth/me", async (request) => ({ user: auth.coordinator(request).account }));
  app.post("/auth/logout", async (request, reply) => { await auth.logout(request, reply); return { ok: true }; });
  app.get("/auth/accounts", async (request) => { auth.admin(request); return { accounts: auth.accounts() }; });
  app.post<{ Body: { email?: unknown; password?: unknown; name?: unknown; role?: unknown; studyIds?: unknown } }>("/auth/accounts", async (request, reply) => {
    auth.admin(request);
    return reply.code(201).send({ user: await auth.createAccount(request.body ?? {}) });
  });
  app.post<{ Params: { id: string } }>("/auth/accounts/:id/disable", async (request) => {
    await auth.disable(request.params.id, auth.admin(request).account.id); return { ok: true };
  });

  app.get("/documents", async (request) => {
    const principal = auth.coordinator(request);
    return { documents: store.listDocuments().filter((d) => auth.canAccess(principal, d.studyId)).map(({ sections, ...document }) => ({ ...document, sections: sections.map(({ id, title }) => ({ id, title })) })) };
  });
  app.get<{ Params: { id: string } }>("/documents/:id", async (request) => {
    const principal = auth.coordinator(request);
    const document = store.getDocument(request.params.id);
    if (!document) throw new HttpError(404, "Consent document not found");
    if (!auth.canAccess(principal, document.studyId)) throw new HttpError(403, "Study access denied");
    return { ...document, sections: document.sections.map(({ embedding: _vector, ...section }) => section) };
  });
  const visibleDocument = (document: NonNullable<ReturnType<JsonStore["getDocument"]>>) => ({ ...document, sections: document.sections.map(({ embedding: _embedding, ...s }) => s) });
  const scopedDocument = (request: FastifyRequest, id: string) => {
    const principal = auth.coordinator(request);
    const document = store.getDocument(id);
    if (!document) throw new HttpError(404, "Document not found");
    if (!auth.canAccess(principal, document.studyId)) throw new HttpError(403, "Study access denied");
    return { document, principal };
  };
  for (const action of ["draft", "edit", "publish", "archive"] as const) {
    app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(`/documents/:id/${action}`, async (request) => {
      const { document, principal } = scopedDocument(request, request.params.id);
      if (action === "publish") auth.admin(request);
      const body = request.body ?? {};
      const result = action === "draft" ? await documents.draft(document, body, principal.account.id)
        : action === "edit" ? await documents.edit(document, body, principal.account.id)
        : await documents[action](document, body.revision, principal.account.id);
      return visibleDocument(result);
    });
  }
  const scopedSession = (request: FastifyRequest, id: string) => {
    const principal = auth.coordinator(request);
    const session = store.getSession(id);
    if (!session) throw new HttpError(404, "Session not found");
    if (!auth.canAccess(principal, session.studyId)) throw new HttpError(403, "Study access denied");
    return { session, principal };
  };
  app.get<{ Params: { id: string } }>("/sessions/:id/follow-ups", async (request) => {
    const { session } = scopedSession(request, request.params.id);
    const assignees = store.getAuth().accounts.filter((a) => !a.disabled && (a.role === "admin" || a.studyIds.includes(session.studyId))).map(({ id, name }) => ({ id, name }));
    return { flags: workflows.read(session), assignees };
  });
  app.post<{ Params: { id: string }; Body: { description?: unknown } }>("/sessions/:id/flags", async (request, reply) => {
    const { session, principal } = scopedSession(request, request.params.id);
    return reply.code(201).send({ flags: await workflows.add(session, request.body?.description, principal.account.id) });
  });
  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>("/sessions/:id/follow-ups", async (request) => {
    const { session, principal } = scopedSession(request, request.params.id);
    return { flags: await workflows.update(session, principal.account.id, request.body ?? {}) };
  });
  app.get("/notifications", async (request) => {
    const principal = auth.coordinator(request);
    return { notifications: store.listSessions().filter((session) => auth.canAccess(principal, session.studyId) && store.settings(session.studyId).notificationsEnabled)
      .flatMap((session) => workflows.read(session).filter((f) => f.status !== "resolved" && (!f.assigneeId || f.assigneeId === principal.account.id)).map((flag) => ({
        id: `${session.id}:${flag.id}`, sessionId: session.id, studyId: session.studyId, description: flag.description, status: flag.status, dueAt: flag.dueAt,
        overdue: !!flag.dueAt && Date.parse(flag.dueAt) <= Date.now(),
      }))) };
  });
  app.get("/notifications/delivery", async (request) => {
    const principal = auth.coordinator(request);
    return { enabled: notifications.enabled, deliveries: store.notifications().filter((n) => auth.canAccess(principal, n.studyId)) };
  });
  app.post<{ Params: { id: string }; Body: { flagId?: unknown } }>("/sessions/:id/notifications", async (request, reply) => {
    const { session, principal } = scopedSession(request, request.params.id);
    const notification = await notifications.enqueue(session, request.body?.flagId);
    await audit.append("notification.queued", { notificationId: notification.id, accountId: principal.account.id }, session.id);
    return reply.code(202).send(notification);
  });
  app.post<{ Params: { id: string } }>("/notifications/:id/retry", async (request) => {
    const principal = auth.coordinator(request);
    const notification = store.notifications().find((n) => n.id === request.params.id);
    if (!notification) throw new HttpError(404, "Notification not found");
    if (!auth.canAccess(principal, notification.studyId)) throw new HttpError(403, "Study access denied");
    await notifications.retry(notification.id);
    await audit.append("notification.retry_requested", { notificationId: notification.id, accountId: principal.account.id }, notification.sessionId);
    return { ok: true };
  });
  app.get<{ Params: { studyId: string } }>("/studies/:studyId/settings", async (request) => {
    auth.study(request, request.params.studyId); return store.settings(request.params.studyId);
  });
  app.post<{ Params: { studyId: string }; Body: Record<string, unknown> }>("/studies/:studyId/settings", async (request) => {
    const principal = auth.admin(request);
    if (!/^[A-Za-z0-9._-]{1,100}$/.test(request.params.studyId)) throw new HttpError(400, "Invalid study ID");
    return workflows.settings(request.params.studyId, request.body ?? {}, principal.account.id);
  });
  app.post<{ Params: { id: string }; Body: { accepted?: unknown } }>("/sessions/:id/acknowledgment", async (request) => {
    const access = auth.session(request, request.params.id);
    if (access.kind !== "patient") throw new HttpError(403, "Only the participant review access can acknowledge completion");
    if (request.body?.accepted !== true) throw new HttpError(400, "Explicit review acknowledgment is required");
    return sessions.acknowledge(request.params.id, "patient", mutationOptions(request));
  });
  app.get("/sessions", async (request) => {
    const principal = auth.coordinator(request);
    return { sessions: store.listSessions().filter((session) => auth.canAccess(principal, session.studyId)).map((session) => ({
      sessionId: session.id, documentId: session.documentId, studyId: session.studyId,
      documentVersion: session.documentVersion,
      documentTitle: session.documentSnapshot?.title ?? store.getDocument(session.documentId)?.title ?? "Consent document",
      startedAt: session.startedAt, updatedAt: session.updatedAt, status: session.status,
      reviewedSections: session.results.length, totalSections: (session.documentSnapshot ?? store.getDocument(session.documentId))?.sections.length ?? 0,
      requiresFollowUp: workflows.read(session).some((f) => f.status !== "resolved"),
    })).sort((a, b) => b.startedAt.localeCompare(a.startedAt)) };
  });
  app.get<{ Params: { id: string } }>("/sessions/:id", async (request) => {
    const access = auth.session(request, request.params.id);
    return { ...await sessions.read(request.params.id), accessRole: access.kind };
  });
  app.post<{ Params: { id: string } }>("/sessions/:id/invitations", async (request, reply) => {
    const principal = auth.coordinator(request);
    const session = store.getSession(request.params.id);
    if (!session) throw new HttpError(404, "Session not found");
    if (!auth.canAccess(principal, session.studyId)) throw new HttpError(403, "Study access denied");
    const invitation = await auth.invite(session.id, principal);
    await audit.append("access.invited", { accountId: principal.account.id }, session.id);
    return reply.code(201).send(invitation);
  });
  app.post<{ Params: { id: string }; Body: { invitationToken?: unknown; accessCode?: unknown } }>("/sessions/:id/access", async (request, reply) => {
    const result = await auth.exchange(request, reply, request.params.id, request.body?.invitationToken, request.body?.accessCode);
    await audit.append("access.redeemed", {}, request.params.id);
    return result;
  });
  app.post<{ Params: { id: string } }>("/sessions/:id/access/revoke", async (request) => {
    const principal = auth.coordinator(request);
    const session = store.getSession(request.params.id);
    if (!session) throw new HttpError(404, "Session not found");
    if (!auth.canAccess(principal, session.studyId)) throw new HttpError(403, "Study access denied");
    await auth.revokeSession(session.id);
    await audit.append("access.revoked", { accountId: principal.account.id }, session.id);
    return { ok: true };
  });
  app.post<{ Params: { id: string } }>("/sessions/:id/logout", async (request, reply) => { await auth.logout(request, reply, request.params.id); return { ok: true }; });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/agents/provision", async (request) => {
    auth.admin(request);
    return elevenLabsAgent.provision();
  });

  app.get<{ Params: { id: string } }>("/sessions/:id/conversation-url", async (request) => {
    auth.session(request, request.params.id);
    const session = store.getSession(request.params.id);
    if (!session) throw new HttpError(404, "Session not found");
    if (session.status === "completed") throw new HttpError(409, "Session is already complete");
    const signedUrl = await elevenLabsAgent.getSignedUrl();
    const access = await auth.voiceToken(request, session.id);
    return {
      signedUrl,
      dynamicVariables: {
        session_id: session.id,
        session_access: access,
        opening_message: session.lastAssistantMessage,
        session_revision: String(session.revision ?? 0),
      },
    };
  });

  app.post<{ Body: { sessionId?: unknown; sessionAccess?: unknown; question?: unknown; requestId?: unknown; expectedRevision?: unknown } }>("/elevenlabs/tools/questions", async (request) => {
    requireElevenLabsTool(request, config);
    const { sessionId, question } = request.body ?? {};
    if (typeof sessionId !== "string" || !sessionId.trim()) throw new HttpError(400, "sessionId is required");
    if (typeof question !== "string") throw new HttpError(400, "question is required");
    auth.requireVoice(sessionId, request.body?.sessionAccess);
    return sessions.ask(sessionId, question, voiceOptions(request));
  });

  app.post<{ Body: { sessionId?: unknown; sessionAccess?: unknown; response?: unknown; requestId?: unknown; expectedRevision?: unknown } }>("/elevenlabs/tools/responses", async (request) => {
    requireElevenLabsTool(request, config);
    const { sessionId, response } = request.body ?? {};
    if (typeof sessionId !== "string" || !sessionId.trim()) throw new HttpError(400, "sessionId is required");
    if (typeof response !== "string") throw new HttpError(400, "response is required");
    auth.requireVoice(sessionId, request.body?.sessionAccess);
    return sessions.respond(sessionId, response, voiceOptions(request));
  });

  app.post("/documents", async (request, reply) => {
    auth.coordinator(request);
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
    auth.study(request, fields.studyId);
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
    auth.coordinator(request);
    const documentId = request.body?.documentId;
    if (typeof documentId !== "string" || !documentId.trim()) throw new HttpError(400, "documentId is required");
    const document = store.getDocument(documentId);
    if (!document) throw new HttpError(404, "Consent document not found");
    auth.study(request, document.studyId);
    const key = mutationOptions(request).key;
    const result = await sessions.start(document, key ? `${auth.coordinator(request).account.id}:${key}` : undefined);
    return reply.code(201).send({
      sessionId: result.session.id,
      status: result.session.status,
      disclosure: result.message.split("\n\n")[0],
      message: result.message,
      section: result.section,
    });
  });

  app.post<{ Params: { id: string }; Body: { response?: unknown } }>("/sessions/:id/responses", async (request) => {
    auth.session(request, request.params.id);
    const response = request.body?.response;
    if (typeof response !== "string") throw new HttpError(400, "response is required");
    return sessions.respond(request.params.id, response, mutationOptions(request));
  });

  app.post<{ Params: { id: string }; Body: { question?: unknown } }>("/sessions/:id/questions", async (request) => {
    auth.session(request, request.params.id);
    const question = request.body?.question;
    if (typeof question !== "string") throw new HttpError(400, "question is required");
    return sessions.ask(request.params.id, question, mutationOptions(request));
  });

  app.get<{ Params: { id: string } }>("/sessions/:id/report", async (request) => {
    const principal = auth.coordinator(request);
    const session = store.getSession(request.params.id);
    if (!session) throw new HttpError(404, "Session not found");
    if (!auth.canAccess(principal, session.studyId)) throw new HttpError(403, "Study access denied");
    return sessions.report(request.params.id);
  });

  app.post<{ Params: { id: string } }>("/sessions/:id/audio", async (request) => {
    auth.session(request, request.params.id);
    const part = await request.file();
    if (!part) throw new HttpError(400, "Audio file is required");
    if (part.fieldname !== "file") throw new HttpError(400, "Audio must use the file field");
    const bytes = await part.toBuffer();
    if (part.file.truncated) throw new HttpError(413, "Audio exceeds the 10 MiB limit");
    return sessions.audio(request.params.id, bytes, part.mimetype, mutationOptions(request));
  });

  app.post<{ Params: { id: string } }>("/sessions/:id/speech", async (request, reply) => {
    auth.session(request, request.params.id);
    const session = store.getSession(request.params.id);
    if (!session) throw new HttpError(404, "Session not found");
    const audio = await synthesizeSpeech(config, session.lastAssistantMessage);
    await audit.append("voice.synthesized", { characters: session.lastAssistantMessage.length }, session.id);
    return reply.type("audio/mpeg").send(audio);
  });

  return app;
}

function clientErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "statusCode" in error &&
    typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) return error.statusCode;
  return undefined;
}

function mutationOptions(request: FastifyRequest): MutationOptions {
  const key = request.headers["idempotency-key"];
  const revision = request.headers["if-match"];
  if (key !== undefined && (typeof key !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(key))) throw new HttpError(400, "Invalid Idempotency-Key");
  if (revision !== undefined && (typeof revision !== "string" || !/^\d{1,10}$/.test(revision))) throw new HttpError(400, "Invalid If-Match revision");
  return { ...(key ? { key: key as string } : {}), ...(revision !== undefined ? { revision: Number(revision) } : {}) };
}

function voiceOptions(request: FastifyRequest): MutationOptions {
  const body = request.body as Record<string, unknown>;
  if (typeof body.requestId !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(body.requestId) || typeof body.expectedRevision !== "string" || !/^\d{1,10}$/.test(body.expectedRevision)) throw new HttpError(400, "Provide a unique requestId and the last known expectedRevision");
  return { key: body.requestId, revision: Number(body.expectedRevision) };
}
