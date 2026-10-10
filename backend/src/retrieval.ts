import type { AiProvider, ConsentSection } from "./types.js";

export function cosineSimilarity(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  return leftNorm === 0 || rightNorm === 0 ? 0 : dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export async function retrieveRelevant(
  ai: AiProvider,
  query: string,
  sections: ConsentSection[],
  limit = 4,
): Promise<ConsentSection[]> {
  const embedding = await ai.embed(query);
  return sections
    .map((section) => ({ section, score: cosineSimilarity(embedding, section.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .filter(({ score }) => score > 0)
    .map(({ section }) => section);
}
