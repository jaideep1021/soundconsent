import { describe, it, expect, vi, afterEach } from "vitest";
import { backendApi } from "../src/lib/backend-api";
import { createVoiceTools } from "../src/lib/voice-tools";
import { mergeReviewTranscript } from "../src/lib/review-transcript";
import { AxiosError } from "axios";

afterEach(() => vi.restoreAllMocks());
const turn = (revision: number) => ({ sessionId: "session", revision, status: "in_progress" as const, message: "Next question", section: { index: 1, total: 2, title: "Purpose" } });

describe("voice tool processing", () => {
  it("serializes spoken turns and carries forward backend revisions", async () => {
    const send = vi.spyOn(backendApi, "message").mockResolvedValueOnce(turn(8)).mockResolvedValueOnce(turn(9));
    const voice = createVoiceTools("session", 7, vi.fn(), () => true);
    await Promise.all([
      voice.clientTools.teach_it_back_submit_teach_back({ response: "Monthly visits" }),
      voice.clientTools.teach_it_back_answer_consent_question({ question: "Are visits optional?" }),
    ]);
    expect(send.mock.calls.map((call) => call[2]?.revision)).toEqual([7, 8]);
    expect(send.mock.calls[0][2]?.key).not.toBe(send.mock.calls[1][2]?.key);
  });

  it("retries an uncertain request with the same key without regrading", async () => {
    const send = vi.spyOn(backendApi, "message").mockRejectedValueOnce(new Error("Network failure")).mockResolvedValueOnce(turn(8));
    const voice = createVoiceTools("session", 7, vi.fn(), () => true);
    await expect(voice.clientTools.teach_it_back_submit_teach_back({ response: "Monthly visits" })).rejects.toThrow();
    await voice.clientTools.teach_it_back_submit_teach_back({ response: "Monthly visits" });
    expect(send.mock.calls[0][2]).toEqual(send.mock.calls[1][2]);
  });

  it("stops on revision conflict instead of silently regrading against new progress", async () => {
    const send = vi.spyOn(backendApi, "message").mockRejectedValue(new AxiosError("Conflict", "ERR_BAD_REQUEST", undefined, undefined, { status: 409, data: { error: "Review changed" } } as never));
    const voice = createVoiceTools("session", 7, vi.fn(), () => true);
    await expect(voice.clientTools.teach_it_back_submit_teach_back({ response: "Monthly visits" })).rejects.toThrow();
    await expect(voice.clientTools.teach_it_back_submit_teach_back({ response: "Monthly visits" })).rejects.toThrow(/review changed/i);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

it("merges persisted and live speech without erasing unmatched turns or repeating processed messages", () => {
  const saved = [{ id: "saved", role: "patient" as const, content: "Monthly visits", timestamp: "2026-10-11T08:00:01Z" }];
  const spoken = [
    { id: "voice-1", role: "patient" as const, content: "Monthly visits", timestamp: "2026-10-11T08:00:00Z" },
    { id: "voice-2", role: "ai" as const, content: "I could not process that answer", timestamp: "2026-10-11T08:00:02Z" },
  ];
  expect(mergeReviewTranscript(saved, [...spoken, ...spoken]).map((message) => message.id)).toEqual(["saved", "voice-2"]);
});
