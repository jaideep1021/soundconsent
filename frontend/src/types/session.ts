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
export interface SessionData {
  id: string;
  patientName: string;
  procedureName: string;
  dateOfBirth: string;
  sections: Section[];
  messages: Message[];
  mode: "chat" | "voice";
  status: "pending" | "in-progress" | "completed";
  signature?: { name: string; signedAt: string; acknowledged: true };
  flagged?: boolean;
  followUpAt?: string;
  acknowledgedAt?: string;
  inquiries?: string[];
}
