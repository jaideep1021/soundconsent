import { createHash, randomUUID } from "node:crypto";
import { HttpError } from "./errors.js";
import { redactPii } from "./privacy.js";
import type { AuditLog } from "./audit.js";
import { JsonStore } from "./store.js";
import type { AiProvider, ConsentDocument, ReviewSession, MutationOptions, TranscriptEntry } from "./types.js";
import { retrieveRelevant } from "./retrieval.js";

export const HUMAN_HANDOFF = "I am an automated assistant here to help explain this consent form and answer your questions as clearly as I can. I am not a doctor, and this review does not record your consent. For sensitive or personal medical concerns, I will explain what I can, strongly recommend confirming with your doctor, and flag the concern in your report for the clinical team to review. You may ask for a human at any time.";
const CLINICIAN_FOLLOW_UP = "I strongly recommend confirming this information and any medical decisions with your doctor before acting. I've flagged your question in your report for the clinical team to review.";

export class SessionService {
  private readonly sessionQueues = new Map<string, Promise<void>>();

  constructor(
    private readonly store: JsonStore,
    private readonly audit: AuditLog,
    private readonly ai: AiProvider,
  ) {}

  async saveVoiceTranscript(sessionId: string, messages: TranscriptEntry[]) {
    return this.withSessionLock(sessionId, async () => {
      const session = this.getSession(sessionId);
      session.voiceTranscript ??= [];
      for (const message of messages) {
        if (!session.voiceTranscript.some((saved) => saved.id === message.id)) {
          session.voiceTranscript.push({ id: message.id, role: message.role, content: redactPii(message.content), timestamp: message.timestamp });
        }
      }
      // Observed speech is history, never a grading input or proof of completion.
      // Preserve the review revision so transcript writes cannot stale a voice turn.
      await this.store.saveSession(session);
    });
  }

  async start(document: ConsentDocument, creationKey?: string): Promise<{ session: ReviewSession; message: string; section: unknown }> {
    return this.withSessionLock("creation", async () => {
    if (creationKey) {
      const prior = this.store.listSessions().find((s) => s.creationKey === creationKey);
      if (prior) {
        if (prior.documentId !== document.id) throw new HttpError(409, "Request key already used for another document");
        return { session: prior, message: prior.lastAssistantMessage, section: this.sectionProgress(prior, prior.documentSnapshot ?? document) };
      }
    }
    if (document.lifecycle === "draft" || document.lifecycle === "archived") throw new HttpError(409, "Only published documents can start reviews");
    const session: ReviewSession = {
      id: randomUUID(),
      documentId: document.id,
      studyId: document.studyId,
      documentVersion: document.version,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "in_progress",
      sectionIndex: 0,
      attemptsForCurrentSection: 0,
      results: [],
      outOfScopeQuestions: [],
      lastAssistantMessage: "",
      documentSnapshot: structuredClone(document),
      transcript: [], revision: 0, maxAttempts: this.store.settings(document.studyId).maxAttempts, followUpDays: this.store.settings(document.studyId).reminderDays,
      ...(creationKey ? { creationKey } : {}),
    };
    const guide = await this.currentGuide(session, document);
    const message = `${HUMAN_HANDOFF}\n\n${guide.summary}\n\n${guide.question}`;
    session.lastAssistantMessage = message;
    session.guide = guide;
    this.record(session, "ai", message);
    await this.audit.append("session.started", { documentId: document.id, studyId: document.studyId, version: document.version }, session.id);
    await this.store.saveSession(session);
    await this.audit.append("assistant.guide", { section: document.sections[0]?.title, message }, session.id);
    return { session, message, section: this.sectionProgress(session, document) };
    });
  }

  async message(sessionId: string, rawMessage: string, options: MutationOptions = {}): Promise<Record<string, unknown>> {
    const message = redactPii(rawMessage.trim());
    if (!message || rawMessage.trim().length > 5000) throw new HttpError(400, "Message must be between 1 and 5000 characters");
    return this.mutate(sessionId, "message:" + rawMessage, options, async (session) => {
      if (session.status === "completed") throw new HttpError(409, "Session is already complete");
      // Preserve immediate handoffs even when the classifier is unavailable.
      if (isEmergency(message) || isHumanRequest(message)) return { ...await this.respondLocked(session, message), intent: "question" };
      const document = session.documentSnapshot ?? this.getDocument(session.documentId);
      const section = document.sections[session.sectionIndex];
      if (!section) throw new HttpError(500, "Current section is missing");
      const intent = await this.ai.classifyMessage(message, {
        section, guide: session.guide ?? null,
        recentMessages: (session.transcript ?? []).slice(-6).map(({ role, content }) => ({ role, content: redactPii(content) })),
      });
      if (intent === "response") return { ...await this.respondLocked(session, message), intent };
      if (intent === "question") {
        const answer = await this.askLocked(session, message, 5000);
        return { ...answer, intent, message: answer.answer, status: session.status, section: this.sectionProgress(session, document) };
      }
      if (intent !== "clarify") throw new HttpError(502, "Unable to understand message intent. Please try again.");
      const reply = "Tell me what you understand about this section in your own words, or let me know what you would like me to explain.";
      session.lastAssistantMessage = reply;
      this.record(session, "patient", message);
      this.record(session, "ai", reply);
      await this.audit.append("message.clarification_requested", { message, response: reply }, session.id);
      return { sessionId: session.id, intent, message: reply, status: session.status, section: this.sectionProgress(session, document) };
    });
  }

  async respond(sessionId: string, rawResponse: string, options: MutationOptions = {}): Promise<Record<string, unknown>> {
    return this.mutate(sessionId, "response:" + rawResponse, options, (session) => this.respondLocked(session, rawResponse));
  }

  private async respondLocked(session: ReviewSession, rawResponse: string): Promise<Record<string, unknown>> {
    if (session.status === "completed") throw new HttpError(409, "Session is already complete");
    const response = redactPii(rawResponse.trim());
    if (!response || response.length > 5000) throw new HttpError(400, "Response must be between 1 and 5000 characters");
    const document = session.documentSnapshot ?? this.getDocument(session.documentId);
    if (isEmergency(response)) {
      const message = "If this is an emergency, call 911 now. Please ask your doctor about medical concerns.";
      session.outOfScopeQuestions.push({ question: response, askedAt: new Date().toISOString() });
      session.updatedAt = new Date().toISOString();
      session.lastAssistantMessage = message;
      this.record(session, "patient", response);
      this.record(session, "ai", message);
      await this.audit.append("question.emergency_escalated", { question: response, response: message }, session.id);
      return {
        sessionId: session.id,
        status: session.status,
        message,
        section: this.sectionProgress(session, document),
        requiresClinician: true,
        emergency: true,
      };
    }
    if (isHumanRequest(response)) {
      const message = "I can’t connect you through this chat. Please ask the study coordinator or nurse to speak with you now.";
      session.outOfScopeQuestions.push({ question: response, askedAt: new Date().toISOString() });
      session.updatedAt = new Date().toISOString();
      session.lastAssistantMessage = message;
      this.record(session, "patient", response);
      this.record(session, "ai", message);
      await this.audit.append("question.human_handoff", { question: response, response: message }, session.id);
      return {
        sessionId: session.id,
        status: session.status,
        message,
        section: this.sectionProgress(session, document),
        requiresClinician: true,
      };
    }
    const section = document.sections[session.sectionIndex];
    if (!section) throw new HttpError(500, "Current section is missing");
    // Use the persisted question actually shown, including a rephrased question.
    // Legacy sessions without a guide cannot demonstrate a pass against an unknown
    // question; use the existing re-explanation/follow-up path instead.
    const question = session.guide?.question;
    const passed = question?.trim() ? await this.ai.grade(section, response, question) : false;
    const attempts = session.attemptsForCurrentSection + 1;
    const result = { sectionId: section.id, sectionTitle: section.title, passed, attempts, response, finalizedAt: new Date().toISOString() };
    let message: string;
    let nextSectionIndex: number | undefined;
    let completed = false;
    if (!passed && attempts < (session.maxAttempts ?? 2)) {
      const guide = await this.currentGuide(session, document, true);
      session.guide = guide;
      message = `Let's review this section another way.\n\n${guide.summary}\n\n${guide.question}`;
    } else {
      nextSectionIndex = session.sectionIndex + 1;
      completed = nextSectionIndex >= document.sections.length;
      let nextMessage: string;
      if (completed) {
        session.guide = null;
        nextMessage = "You have finished reviewing this form. Please discuss your questions and final decision with the clinical team. This review does not record your consent.";
      } else {
        const nextSection = document.sections[nextSectionIndex];
        if (!nextSection) throw new HttpError(500, "Next section is missing");
        const nextGuide = await this.ai.createGuide(nextSection);
        session.guide = nextGuide;
        nextMessage = `${nextGuide.summary}\n\n${nextGuide.question}`;
      }
      message = passed
        ? nextMessage
        : `I will flag "${section.title}" for the clinical team to review with you.\n\n${nextMessage}`;
    }

    session.attemptsForCurrentSection = nextSectionIndex === undefined ? attempts : 0;
    if (passed || attempts >= (session.maxAttempts ?? 2)) session.results.push(result);
    if (nextSectionIndex !== undefined) session.sectionIndex = nextSectionIndex;
    if (completed) { session.status = "completed"; session.completedAt = new Date().toISOString(); }
    session.updatedAt = new Date().toISOString();
    session.lastAssistantMessage = message;
    this.record(session, "patient", response, section.id);
    this.record(session, "ai", message);
    await this.audit.append("teachback.graded", { sectionId: section.id, sectionTitle: section.title, passed, attempts, response }, session.id);
    if (!passed && attempts >= (session.maxAttempts ?? 2)) {
      await this.audit.append("teachback.flagged", { sectionId: section.id, sectionTitle: section.title, attempts }, session.id);
    }
    if (completed) await this.audit.append("session.completed", { report: this.reportFor(session) }, session.id);
    await this.audit.append("assistant.response", { message }, session.id);
    return { sessionId: session.id, status: session.status, message, section: this.sectionProgress(session, document) };
  }

  async ask(sessionId: string, rawQuestion: string, options: MutationOptions = {}): Promise<Record<string, unknown>> {
    return this.mutate(sessionId, "question:" + rawQuestion, options, (session) => this.askLocked(session, rawQuestion));
  }

  private async askLocked(session: ReviewSession, rawQuestion: string, maxLength = 2000): Promise<Record<string, unknown>> {
    const sessionId = session.id;
    if (session.status === "completed") throw new HttpError(409, "Session is already complete");
    const question = redactPii(rawQuestion.trim());
    if (!question || question.length > maxLength) throw new HttpError(400, `Question must be between 1 and ${maxLength} characters`);
    if (isEmergency(question)) {
      const answer = "If this is an emergency, call 911 now. Please ask your doctor about medical concerns.";
      session.outOfScopeQuestions.push({ question, askedAt: new Date().toISOString() });
      session.updatedAt = new Date().toISOString();
      session.lastAssistantMessage = answer;
      this.record(session, "patient", question);
      this.record(session, "ai", answer);
      await this.audit.append("question.emergency_escalated", { question, response: answer }, session.id);
      return { sessionId, answer, citations: [], requiresClinician: true, emergency: true };
    }
    if (isHumanRequest(question)) {
      const answer = "I can’t connect you through this chat. Please ask the study coordinator or nurse to speak with you now.";
      session.outOfScopeQuestions.push({ question, askedAt: new Date().toISOString() });
      session.updatedAt = new Date().toISOString();
      session.lastAssistantMessage = answer;
      this.record(session, "patient", question);
      this.record(session, "ai", answer);
      await this.audit.append("question.human_handoff", { question, response: answer }, session.id);
      return { sessionId, answer, citations: [], requiresClinician: true };
    }
    const document = session.documentSnapshot ?? this.getDocument(session.documentId);
    const relevant = await retrieveRelevant(this.ai, question, document.sections);
    const safe = await this.ai.answerQuestion(question, relevant);
    if (safe.requiresClinician) {
      safe.answer = `${safe.answer}\n\n${CLINICIAN_FOLLOW_UP}`;
      session.outOfScopeQuestions.push({ question, askedAt: new Date().toISOString() });
      await this.audit.append("question.escalated", { question, answer: safe.answer, citations: safe.citations }, session.id);
    } else {
      await this.audit.append("question.answered", { question, answer: safe.answer, citations: safe.citations }, session.id);
    }
    session.updatedAt = new Date().toISOString();
    session.lastAssistantMessage = safe.answer;
    this.record(session, "patient", question);
    this.record(session, "ai", safe.answer, undefined, safe.citations);
    return { sessionId, answer: safe.answer, citations: safe.citations, requiresClinician: safe.requiresClinician };
  }

  async read(sessionId: string): Promise<Record<string, unknown>> {
    return this.withSessionLock(sessionId, async () => {
      const session = this.getSession(sessionId);
      const document = session.documentSnapshot ?? this.getDocument(session.documentId);
      return {
        sessionId: session.id, documentId: document.id, documentTitle: document.title,
        studyId: session.studyId, documentVersion: session.documentVersion,
        status: session.status, startedAt: session.startedAt, updatedAt: session.updatedAt,
        completedAt: session.completedAt ?? (session.status === "completed" ? session.updatedAt : null),
        message: session.lastAssistantMessage, disclosure: HUMAN_HANDOFF,
        section: this.sectionProgress(session, document),
        revision: session.revision ?? 0, maxAttempts: session.maxAttempts ?? 2, acknowledgment: session.acknowledgment ?? null,
        attemptsForCurrentSection: session.attemptsForCurrentSection,
        guide: session.guide ?? null,
        transcript: session.transcript ?? [], historyAvailable: session.transcript !== undefined && !session.historyIncomplete,
        voiceTranscript: session.voiceTranscript ?? [],
        sections: document.sections.map(({ id, title, text }, index) => ({
          id, title, text,
          status: index < session.sectionIndex ? (session.results.find((r) => r.sectionId === id)?.passed ? "completed" : "needs-review") : index === session.sectionIndex ? "active" : "pending",
        })),
        results: session.results, outOfScopeQuestions: session.outOfScopeQuestions,
        humanHandoffRequired: true, consentObtained: false,
      };
    });
  }

  async audio(sessionId: string, bytes: Buffer, mime: string, options: MutationOptions = {}) {
    if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new HttpError(413, "Audio must be between 1 byte and 10 MiB");
    if (!/^audio\/(?:aac|flac|mp3|m4a|mpeg|mpga|ogg|opus|wav|webm)$/i.test(mime)) throw new HttpError(415, "Audio format is not supported");
    const fingerprint = "audio:" + mime + ":" + createHash("sha256").update(bytes).digest("hex");
    return this.mutate(sessionId, fingerprint, options, async (session) => {
      if (session.status === "completed") throw new HttpError(409, "Session is already complete");
      const transcript = await this.ai.transcribeAudio(bytes, mime);
      await this.audit.append("voice.transcribed", { transcript: redactPii(transcript) }, sessionId);
      return this.respondLocked(session, transcript);
    });
  }

  async acknowledge(sessionId: string, actor: "patient" | "coordinator", options: MutationOptions = {}) {
    return this.mutate(sessionId, "acknowledgment:" + actor, options, async (session) => {
      if (session.status !== "completed") throw new HttpError(409, "Complete the review before acknowledging it");
      if (!session.acknowledgment) {
        session.acknowledgment = { text: REVIEW_ACKNOWLEDGMENT, acknowledgedAt: new Date().toISOString(), actor, documentVersion: session.documentVersion };
        await this.audit.append("review.acknowledged", session.acknowledgment, sessionId);
      }
      return { acknowledgment: session.acknowledgment, consentObtained: false };
    });
  }

  private async mutate(sessionId: string, payload: string, options: MutationOptions, action: (session: ReviewSession) => Promise<Record<string, unknown>>) {
    return this.withSessionLock(sessionId, async () => {
      const session = this.getSession(sessionId);
      const fingerprint = createHash("sha256").update(payload).digest("hex");
      const receipt = options.key ? session.receipts?.["request:" + options.key] : undefined;
      if (receipt) {
        if (receipt.fingerprint !== fingerprint) throw new HttpError(409, "Request key already used for different content");
        return receipt.result;
      }
      if (options.revision !== undefined && options.revision !== (session.revision ?? 0)) throw new HttpError(409, "Review changed; refresh before submitting again");
      const result = await action(session);
      session.revision = (session.revision ?? 0) + 1;
      session.updatedAt = new Date().toISOString();
      result.revision = session.revision;
      if (options.key) { session.receipts ??= {}; session.receipts["request:" + options.key] = { fingerprint, result }; }
      await this.store.saveSession(session);
      return result;
    });
  }

  private record(session: ReviewSession, role: "ai" | "patient", content: string, sectionId?: string, citations?: string[]) {
    const document = session.documentSnapshot ?? this.getDocument(session.documentId);
    const id = sectionId ?? document.sections[session.sectionIndex]?.id;
    if (session.transcript === undefined) session.historyIncomplete = true;
    session.transcript ??= [];
    session.transcript.push({ id: randomUUID(), role, content: redactPii(content), timestamp: new Date().toISOString(), ...(id ? { sectionId: id } : {}), ...(citations ? { citations } : {}) });
  }

  report(sessionId: string): Record<string, unknown> {
    const session = this.getSession(sessionId);
    return this.reportFor(session);
  }

  private reportFor(session: ReviewSession): Record<string, unknown> {
    return {
      sessionId: session.id,
      studyId: session.studyId,
      documentVersion: session.documentVersion,
      startedAt: session.startedAt,
      completedAt: session.status === "completed" ? session.completedAt ?? session.updatedAt : null,
      status: session.status,
      sections: session.results.map((result) => ({
        sectionId: result.sectionId,
        title: result.sectionTitle,
        outcome: result.passed ? "passed" : "needs_human_follow_up",
        attempts: result.attempts,
        response: result.response,
      })),
      outOfScopeQuestions: session.outOfScopeQuestions,
      acknowledgment: session.acknowledgment ?? null,
      manualFlags: this.store.manualFlags(session.id),
      followUps: this.store.followUps(session.id),
      humanHandoffRequired: true,
      consentObtained: false,
    };
  }

  private async currentGuide(session: ReviewSession, document: ConsentDocument, rephrase = false) {
    const section = document.sections[session.sectionIndex];
    if (!section) throw new HttpError(500, "Current section is missing");
    return this.ai.createGuide(section, rephrase);
  }

  private sectionProgress(session: ReviewSession, document: ConsentDocument): unknown {
    const current = document.sections[session.sectionIndex];
    return current
      ? { index: session.sectionIndex + 1, total: document.sections.length, title: current.title }
      : { index: document.sections.length, total: document.sections.length, title: null };
  }

  private getSession(id: string): ReviewSession {
    const session = this.store.getSession(id);
    if (!session) throw new HttpError(404, "Session not found");
    return session;
  }

  private getDocument(id: string): ConsentDocument {
    const document = this.store.getDocument(id);
    if (!document) throw new HttpError(404, "Consent document not found");
    return document;
  }

  private async withSessionLock<T>(sessionId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.sessionQueues.get(sessionId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    this.sessionQueues.set(sessionId, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.sessionQueues.get(sessionId) === current) this.sessionQueues.delete(sessionId);
    }
  }
}

function isEmergency(question: string): boolean {
  return /\b(?:emergency|911|can't breathe|cannot breathe|chest pain|overdose|suicid(?:e|al)|severe bleeding|unconscious)\b/i.test(question);
}

function isHumanRequest(question: string): boolean {
  return /\b(?:speak|talk|connect|want|need|please|can i)\b.{0,40}\b(?:human|person|nurse|doctor|coordinator)\b|\b(?:human|person|nurse|doctor|coordinator)\b.{0,40}\b(?:speak|talk|connect|please)\b/i.test(question);
}

export const REVIEW_ACKNOWLEDGMENT = "I acknowledge that I reviewed this form with an automated assistant. This records review completion only. It is not consent to participate. My questions and final decision must be discussed with the clinical team.";
