export type SectionStatus = 'pending' | 'active' | 'completed' | 'needs-review';

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
  role: 'ai' | 'patient';
  content: string;
  timestamp: Date;
}

export interface SessionData {
  id: string;
  patientName: string;
  procedureName: string;
  dateOfBirth: string; // for verification
  sections: Section[];
  messages: Message[];
  mode: 'chat' | 'voice';
  status: 'pending' | 'in-progress' | 'completed';
}
