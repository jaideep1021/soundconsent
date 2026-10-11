import { backendApi, newMutation, type Mutation } from "./backend-api";
import { apiError } from "./api-client";
import axios from "axios";

export function createVoiceTools(sessionId: string, initialRevision: number, onError: (message: string) => void, active: () => boolean) {
  let revision = initialRevision;
  let pending: { content: string; mutation: Mutation } | null = null;
  let blocked = false;
  let queue: Promise<unknown> = Promise.resolve();
  const submit = (field: "question" | "response", parameters: unknown) => {
    const action = async () => {
      try {
        if (!active()) throw new Error("Voice mode has ended. Continue in the text chat.");
        if (blocked) throw new Error("The review changed. End voice mode and refresh the review before continuing.");
        const value = parameters && typeof parameters === "object" ? (parameters as Record<string, unknown>)[field] : undefined;
        if (typeof value !== "string" || !value.trim() || value.length > 5000) throw new Error("The voice tool did not provide a valid message. Continue in the text chat.");
        const content = value.trim();
        if (pending && pending.content !== content) throw new Error("The previous voice response could not be confirmed. End voice mode and check the review before continuing.");
        pending ??= { content, mutation: newMutation(revision) };
        // The backend classifies the utterance; agent tool selection cannot consume
        // a teach-back attempt for a question. Retries reuse the same receipt key.
        const result = await backendApi.message(sessionId, content, pending.mutation);
        if (result.revision === undefined) throw new Error("The review returned no revision. End voice mode and refresh before continuing.");
        revision = result.revision;
        pending = null;
        return JSON.stringify(result);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 409) blocked = true;
        const message = apiError(error);
        onError(message);
        throw new Error(message);
      }
    };
    const result = queue.then(action, action);
    queue = result;
    return result;
  };
  return {
    clientTools: {
      teach_it_back_answer_consent_question: (parameters: unknown) => submit("question", parameters),
      teach_it_back_submit_teach_back: (parameters: unknown) => submit("response", parameters),
    },
    settled: () => queue.catch(() => {}),
  };
}
