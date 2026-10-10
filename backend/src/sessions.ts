import { randomUUID } from "node:crypto";
import { HttpError } from "./errors.js";
import { redactPii } from "./privacy.js";
import type { AuditLog } from "./audit.js";
import { JsonStore } from "./store.js";
import type { AiProvider, ConsentDocument, ReviewSession } from "./types.js";
import { retrieveRelevant } from "./retrieval.js";

export const HUMAN_HANDOFF = "I am an automated assistant, not a doctor. I can help explain this consent form, but I cannot provide medical advice or take your consent. A doctor or nurse will answer medical questions and discuss your final decision. You may ask for a human at any time.";
const FALLBACK = "Please ask your doctor.";

export class SessionService {
  private readonly sessionQueues = new Map<string, Promise<void>>();

  constructor(
    private readonly store: JsonStore,
    private readonly audit: AuditLog,
    private readonly ai: AiProvider,
  ) {}

  async start(document: ConsentDocument): Promise<{ session: ReviewSession; message: string; section: unknown }> {
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
    };
    const guide = await this.currentGuide(session, document);
    const message = `${HUMAN_HANDOFF}\n\n${guide.summary}\n\n${guide.question}`;
    session.lastAssistantMessage = message;
    await this.audit.append("session.started", { documentId: document.id, studyId: document.studyId, version: document.version }, session.id);
    await this.store.saveSession(session);
    await this.audit.append("assistant.guide", { section: document.sections[0]?.title, message }, session.id);
    return { session, message, section: this.sectionProgress(session, document) };
  }

  async respond(sessionId: string, rawResponse: string): Promise<Record<string, unknown>> {
    return this.withSessionLock(sessionId, () => this.respondLocked(sessionId, rawResponse));
  }

  private async respondLocked(sessionId: string, rawResponse: string): Promise<Record<string, unknown>> {
    const session = this.getSession(sessionId);
    if (session.status === "completed") throw new HttpError(409, "Session is already complete");
    const response = redactPii(rawResponse.trim());
    if (!response || response.length > 5000) throw new HttpError(400, "Response must be between 1 and 5000 characters");
    const document = this.getDocument(session.documentId);
    if (isEmergency(response)) {
      const message = "If this is an emergency, call 911 now. Please ask your doctor about medical concerns.";
      session.outOfScopeQuestions.push({ question: response, askedAt: new Date().toISOString() });
      session.updatedAt = new Date().toISOString();
      session.lastAssistantMessage = message;
      await this.audit.append("question.emergency_escalated", { question: response, response: message }, session.id);
      await this.store.saveSession(session);
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
      await this.audit.append("question.human_handoff", { question: response, response: message }, session.id);
      await this.store.saveSession(session);
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
    const passed = await this.ai.grade(section, response);
    const attempts = session.attemptsForCurrentSection + 1;
    const result = { sectionId: section.id, sectionTitle: section.title, passed, attempts, response };
    let message: string;
    let nextSectionIndex: number | undefined;
    let completed = false;
    if (!passed && attempts < 2) {
      const guide = await this.currentGuide(session, document, true);
      message = `Let's review this section another way.\n\n${guide.summary}\n\n${guide.question}`;
    } else {
      nextSectionIndex = session.sectionIndex + 1;
      completed = nextSectionIndex >= document.sections.length;
      let nextMessage: string;
      if (completed) {
        nextMessage = "You have finished reviewing this form. Please discuss your questions and final decision with the clinical team. This review does not record your consent.";
      } else {
        const nextSection = document.sections[nextSectionIndex];
        if (!nextSection) throw new HttpError(500, "Next section is missing");
        const nextGuide = await this.ai.createGuide(nextSection);
        nextMessage = `${nextGuide.summary}\n\n${nextGuide.question}`;
      }
      message = passed
        ? nextMessage
        : `I will flag "${section.title}" for the clinical team to review with you.\n\n${nextMessage}`;
    }

    session.attemptsForCurrentSection = nextSectionIndex === undefined ? attempts : 0;
    if (passed || attempts >= 2) session.results.push(result);
    if (nextSectionIndex !== undefined) session.sectionIndex = nextSectionIndex;
    if (completed) session.status = "completed";
    session.updatedAt = new Date().toISOString();
    session.lastAssistantMessage = message;
    await this.audit.append("teachback.graded", { sectionId: section.id, sectionTitle: section.title, passed, attempts, response }, session.id);
    if (!passed && attempts >= 2) {
      await this.audit.append("teachback.flagged", { sectionId: section.id, sectionTitle: section.title, attempts }, session.id);
    }
    if (completed) await this.audit.append("session.completed", { report: this.reportFor(session) }, session.id);
    await this.store.saveSession(session);
    await this.audit.append("assistant.response", { message }, session.id);
    return { sessionId: session.id, status: session.status, message, section: this.sectionProgress(session, document) };
  }

  async ask(sessionId: string, rawQuestion: string): Promise<Record<string, unknown>> {
    return this.withSessionLock(sessionId, () => this.askLocked(sessionId, rawQuestion));
  }

  private async askLocked(sessionId: string, rawQuestion: string): Promise<Record<string, unknown>> {
    const session = this.getSession(sessionId);
    const question = redactPii(rawQuestion.trim());
    if (!question || question.length > 2000) throw new HttpError(400, "Question must be between 1 and 2000 characters");
    if (isEmergency(question)) {
      const answer = "If this is an emergency, call 911 now. Please ask your doctor about medical concerns.";
      session.outOfScopeQuestions.push({ question, askedAt: new Date().toISOString() });
      session.updatedAt = new Date().toISOString();
      session.lastAssistantMessage = answer;
      await this.audit.append("question.emergency_escalated", { question, response: answer }, session.id);
      await this.store.saveSession(session);
      return { sessionId, answer, citations: [], requiresClinician: true, emergency: true };
    }
    if (isHumanRequest(question)) {
      const answer = "I can’t connect you through this chat. Please ask the study coordinator or nurse to speak with you now.";
      session.outOfScopeQuestions.push({ question, askedAt: new Date().toISOString() });
      session.updatedAt = new Date().toISOString();
      session.lastAssistantMessage = answer;
      await this.audit.append("question.human_handoff", { question, response: answer }, session.id);
      await this.store.saveSession(session);
      return { sessionId, answer, citations: [], requiresClinician: true };
    }
    const document = this.getDocument(session.documentId);
    const relevant = await retrieveRelevant(this.ai, question, document.sections);
    const grounded = relevant.length ? await this.ai.answerQuestion(question, relevant) : null;
    const safe = grounded && !grounded.requiresClinician
      ? grounded
      : { answer: FALLBACK, citations: [] as string[], requiresClinician: true };
    if (safe.requiresClinician) {
      session.outOfScopeQuestions.push({ question, askedAt: new Date().toISOString() });
      await this.audit.append("question.escalated", { question, fallback: FALLBACK }, session.id);
    } else {
      await this.audit.append("question.answered", { question, answer: safe.answer, citations: safe.citations }, session.id);
    }
    session.updatedAt = new Date().toISOString();
    session.lastAssistantMessage = safe.answer;
    await this.store.saveSession(session);
    return { sessionId, answer: safe.answer, citations: safe.citations, requiresClinician: safe.requiresClinician };
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
      completedAt: session.status === "completed" ? session.updatedAt : null,
      status: session.status,
      sections: session.results.map((result) => ({
        title: result.sectionTitle,
        outcome: result.passed ? "passed" : "needs_human_follow_up",
        attempts: result.attempts,
        response: result.response,
      })),
      outOfScopeQuestions: session.outOfScopeQuestions,
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
