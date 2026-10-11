export interface ConsentSection {
  id: string;
  title: string;
  text: string;
  embedding: number[];
}

export interface ConsentDocument {
  id: string;
  studyId: string;
  version: string;
  title: string;
  pageCount: number;
  uploadedAt: string;
  sections: ConsentSection[];
  lifecycle?: "draft" | "published" | "archived";
  revision?: number;
  parentId?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface SectionResult {
  sectionId: string;
  sectionTitle: string;
  passed: boolean;
  attempts: number;
  response: string;
  finalizedAt?: string;
}

export interface ReviewSession {
  id: string;
  documentId: string;
  studyId: string;
  documentVersion: string;
  startedAt: string;
  updatedAt: string;
  status: "in_progress" | "completed";
  sectionIndex: number;
  attemptsForCurrentSection: number;
  results: SectionResult[];
  outOfScopeQuestions: Array<{ question: string; askedAt: string }>;
  lastAssistantMessage: string;
  documentSnapshot?: ConsentDocument;
  guide?: SectionGuide | null;
  completedAt?: string;
  transcript?: TranscriptEntry[];
  historyIncomplete?: boolean;
  revision?: number;
  creationKey?: string;
  maxAttempts?: number;
  followUpDays?: number;
  receipts?: Record<string, { fingerprint: string; result: Record<string, unknown> }>;
  acknowledgment?: { text: string; acknowledgedAt: string; actor: "patient" | "coordinator"; documentVersion: string };

}

export interface DatabaseState {
  schemaVersion: 1;
  documents: ConsentDocument[];
  sessions: ReviewSession[];
  auth?: AuthState;
  workflows?: Record<string, FollowUp[]>;
  manualFlags?: Record<string, Array<{ id: string; description: string; createdAt: string; createdBy: string }>>;
  settings?: Record<string, StudySettings>;
  notifications?: DeliveryNotification[];

  elevenLabsAgentId?: string;
  elevenLabsToolIds?: Record<string, string>;
}

export interface SectionGuide {
  summary: string;
  question: string;
}

export interface GroundedAnswer {
  answer: string;
  citations: string[];
  requiresClinician: boolean;
}

export interface AiProvider {
  embed(text: string): Promise<number[]>;
  transcribeAudio(audio: Buffer, mimeType: string): Promise<string>;
  createGuide(section: ConsentSection, rephrase?: boolean): Promise<SectionGuide>;
  grade(section: ConsentSection, response: string): Promise<boolean>;
  answerQuestion(question: string, sections: ConsentSection[]): Promise<GroundedAnswer>;
  verifyAnswer(question: string, answer: GroundedAnswer, sections: ConsentSection[]): Promise<boolean>;
}

export interface TranscriptEntry {
  id: string;
  role: "ai" | "patient";
  content: string;
  timestamp: string;
  sectionId?: string;
  citations?: string[];
}
export interface Account {
  id: string;
  email: string;
  name: string;
  role: "admin" | "coordinator";
  studyIds: string[];
  disabled: boolean;
  passwordHash: string;
}
export interface AuthGrant {
  hash: string;
  kind: "coordinator" | "patient" | "voice";
  accountId?: string;
  sessionId?: string;
  parentHash?: string;
  expiresAt: number;
}
export interface Invitation {
  hash: string;
  codeHash: string;
  sessionId: string;
  accountId?: string;
  expiresAt: number;
}
export interface AuthState {
  accounts: Account[];
  grants: AuthGrant[];
  invitations: Invitation[];
}

export interface StudySettings { maxAttempts: number; reminderDays: number; notificationsEnabled: boolean; revision: number }
export interface FollowUp {
  flagId: string; status: "open" | "acknowledged" | "resolved";
  assigneeId: string | null; dueAt: string | null; revision: number;
  history: Array<{ at: string; accountId: string; status: "open" | "acknowledged" | "resolved"; note: string; assigneeId: string | null; dueAt: string | null }>;
}
export interface MutationOptions { key?: string; revision?: number }

export interface DeliveryNotification {
  id: string; sessionId: string; studyId: string; flagId: string;
  kind: "follow_up" | "reminder"; assigneeId: string | null;
  createdAt: string; status: "pending" | "delivered" | "failed" | "cancelled";
  attempts: number; nextAttemptAt: string; deliveredAt?: string; error?: string;
}
