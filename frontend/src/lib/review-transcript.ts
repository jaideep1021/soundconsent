import type { Message } from "@/types/session";

type TranscriptMessage = Message & { citations?: string[] };

export function mergeReviewTranscript(saved: TranscriptMessage[], spoken: Message[]): TranscriptMessage[] {
  const matched = new Set<string>();
  const byId = new Map<string, Message>();
  for (const message of spoken) byId.set(message.id, message);
  const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
  const extra = [...byId.values()].filter((message) => {
    const match = saved.find((entry) => !matched.has(entry.id) && entry.role === message.role &&
      normalize(entry.content) === normalize(message.content) &&
      Math.abs(Date.parse(entry.timestamp) - Date.parse(message.timestamp)) < 120_000);
    if (match) matched.add(match.id);
    return !match;
  });
  return [...saved, ...extra].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}
