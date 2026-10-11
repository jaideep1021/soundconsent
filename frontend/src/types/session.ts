export type SectionStatus = "pending" | "active" | "completed" | "needs-review";
export interface Section {
  id: string;
  title: string;
  status: SectionStatus;
  summary?: string;
  patientResponse?: string;
  aiAssessment?: string;
}
export interface Message {
  id: string;
  role: "ai" | "patient";
  content: string;
  timestamp: string;
  sectionId?: string;
}
