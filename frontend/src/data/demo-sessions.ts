import type { SessionData } from "@/types/session";
import { demoDocuments } from "./demo-documents";
export function makeSession(
  id: string,
  patientName: string,
  dateOfBirth: string,
  procedureName: string,
  sections: { id: string; title: string; content?: string }[],
): SessionData {
  return {
    id,
    patientName,
    dateOfBirth,
    procedureName,
    mode: "chat",
    status: "pending",
    messages: [],
    sections: sections.map((s) => ({
      id: s.id,
      title: s.title,
      summary: s.content,
      status: "pending",
    })),
  };
}
const example = makeSession(
  "mock-session-1",
  "Jane Doe",
  "1980-05-15",
  "Lumbar Puncture",
  [
    "Procedure Overview",
    "Risks and Side Effects",
    "Alternatives",
    "Recovery and Aftercare",
  ].map((title, i) => ({ id: `s${i + 1}`, title })),
);
const report = makeSession(
  "1",
  "Jane Doe",
  "1980-05-15",
  demoDocuments[0].title,
  demoDocuments[0].sections,
);
report.status = "in-progress";
report.flagged = true;
report.sections = report.sections.map((s, i) => ({
  ...s,
  status: i === 1 ? "needs-review" : "completed",
  patientResponse:
    i === 1
      ? "The doctor will replace the joint with metal. I might feel dizzy from the drugs, and there will be pain for a few weeks."
      : i === 0
        ? "I understand that my knee cartilage is worn out, and the surgery replaces it to help relieve pain."
        : "I could do steroid injections or physical therapy instead, and I do not have to do the surgery if I do not want to.",
  aiAssessment:
    i === 1
      ? "Sample assessment: missed mention of infection risks, deep vein thrombosis (blood clots), and prescribed blood thinners. Re-education recommended."
      : "Sample assessment: section passed.",
}));
report.inquiries = [
  "Can I keep taking my herbal supplements before surgery?",
  "Will Dr. Smith be doing the entire surgery himself or a resident?",
];
export const demoSessions = [
  example,
  report,
  ...["John Smith", "Emily Chen", "Michael Brown"].map((name, i) =>
    makeSession(
      String(i + 2),
      name,
      "1980-05-15",
      demoDocuments[i + 1].title,
      demoDocuments[i + 1].sections,
    ),
  ),
];
