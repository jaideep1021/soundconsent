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
}

export interface SectionResult {
  sectionId: string;
  sectionTitle: string;
  passed: boolean;
  attempts: number;
  response: string;
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
}

export interface DatabaseState {
  schemaVersion: 1;
  documents: ConsentDocument[];
  sessions: ReviewSession[];
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
  createGuide(section: ConsentSection, rephrase?: boolean): Promise<SectionGuide>;
  grade(section: ConsentSection, response: string): Promise<boolean>;
  answerQuestion(question: string, sections: ConsentSection[]): Promise<GroundedAnswer>;
  verifyAnswer(question: string, answer: GroundedAnswer, sections: ConsentSection[]): Promise<boolean>;
}
