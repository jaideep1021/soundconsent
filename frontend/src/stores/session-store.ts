import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { SessionData, Message } from "@/types/session";
import { demoSessions, makeSession } from "@/data/demo-sessions";
import { normalizeName, newSessionSchema } from "@/lib/validators";
import { useDocumentStore } from "./document-store";
interface SessionState {
  records: SessionData[];
  session: SessionData | null;
  verifiedSessionId: string | null;
  error: string | null;
  initializeSession: (id: string) => void;
  verifyIdentity: (name: string, dob: string) => boolean;
  createSession: (data: {
    patientName: string;
    dateOfBirth: string;
    documentId: string;
  }) => string;
  updateRecord: (
    id: string,
    patch: Partial<
      Pick<SessionData, "flagged" | "followUpAt" | "acknowledgedAt">
    >,
  ) => void;
  setMode: (mode: "chat" | "voice") => void;
  startReview: () => void;
  addMessage: (message: Pick<Message, "role" | "content">) => void;
  advanceSection: () => void;
  completeSession: (signature: string) => boolean;
}
export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => {
      const commit = (session: SessionData) =>
        set((state) => ({
          session,
          records: state.records.map((s) =>
            s.id === session.id ? session : s,
          ),
        }));
      return {
        records: demoSessions,
        session: null,
        verifiedSessionId: null,
        error: null,
        initializeSession: (id) => {
          if (get().session?.id === id) return;
          const session = get().records.find((s) => s.id === id) ?? null;
          set({
            session,
            verifiedSessionId: null,
            error: session
              ? null
              : "This demo session is unavailable. Ask your coordinator for a new link.",
          });
        },
        verifyIdentity: (name, dob) => {
          const session = get().session;
          if (
            !session ||
            normalizeName(name) !== normalizeName(session.patientName) ||
            dob !== session.dateOfBirth
          )
            return false;
          set({ verifiedSessionId: session.id });
          if (session.status === "pending")
            commit({ ...session, status: "in-progress" });
          return true;
        },
        createSession: (data) => {
          const validated = newSessionSchema.parse(data);
          const document = useDocumentStore
            .getState()
            .documents.find(
              (d) =>
                d.id === validated.documentId &&
                d.status === "Active" &&
                d.sections.length > 0,
            );
          if (!document)
            throw new Error("Select an active document with sections.");
          const id = crypto.randomUUID();
          const session = makeSession(
            id,
            validated.patientName,
            validated.dateOfBirth,
            document.title,
            document.sections,
          );
          set((state) => ({ records: [session, ...state.records] }));
          return id;
        },
        updateRecord: (id, patch) =>
          set((state) => ({
            records: state.records.map((s) =>
              s.id === id ? { ...s, ...patch } : s,
            ),
            session:
              state.session?.id === id
                ? { ...state.session, ...patch }
                : state.session,
          })),
        setMode: (mode) => {
          const s = get().session;
          if (s) commit({ ...s, mode });
        },
        startReview: () => {
          const s = get().session;
          if (
            !s ||
            get().verifiedSessionId !== s.id ||
            s.status === "completed" ||
            s.sections.some((s) => s.status === "active")
          )
            return;
          const first = s.sections.find((s) => s.status === "pending");
          if (first)
            commit({
              ...s,
              sections: s.sections.map((s) =>
                s.id === first.id ? { ...s, status: "active" } : s,
              ),
            });
        },
        addMessage: (message) => {
          const s = get().session;
          const active = s?.sections.find((s) => s.status === "active");
          if (
            !s ||
            !active ||
            get().verifiedSessionId !== s.id ||
            s.status === "completed"
          )
            return;
          commit({
            ...s,
            messages: [
              ...s.messages,
              {
                ...message,
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                sectionId: active.id,
              },
            ],
            sections: s.sections.map((section) =>
              section.id === active.id && message.role === "patient"
                ? {
                    ...section,
                    patientResponse: [section.patientResponse, message.content]
                      .filter(Boolean)
                      .join("\n"),
                  }
                : section,
            ),
          });
        },
        advanceSection: () => {
          const s = get().session;
          if (
            !s ||
            get().verifiedSessionId !== s.id ||
            s.status === "completed"
          )
            return;
          const active = s.sections.find((s) => s.status === "active");
          if (!active?.patientResponse) return;
          const next = s.sections.find((s) => s.status === "pending");
          commit({
            ...s,
            flagged: true,
            sections: s.sections.map((section) =>
              section.id === active.id
                ? {
                    ...section,
                    status: "needs-review",
                    aiAssessment:
                      "Response recorded in demo mode; understanding has not been evaluated.",
                  }
                : section.id === next?.id
                  ? { ...section, status: "active" }
                  : section,
            ),
          });
        },
        completeSession: (signature) => {
          const s = get().session;
          if (
            !s ||
            get().verifiedSessionId !== s.id ||
            s.status === "completed" ||
            !s.sections.length ||
            s.sections.some(
              (s) => s.status === "pending" || s.status === "active",
            ) ||
            normalizeName(signature) !== normalizeName(s.patientName)
          )
            return false;
          commit({
            ...s,
            status: "completed",
            signature: {
              name: signature.trim().replace(/\s+/g, " "),
              signedAt: new Date().toISOString(),
              acknowledged: true,
            },
          });
          return true;
        },
      };
    },
    {
      name: "demo-sessions-v1",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
