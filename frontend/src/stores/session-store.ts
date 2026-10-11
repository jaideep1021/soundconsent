import { create } from 'zustand';
import type { SessionData, Message } from '@/types/session';

interface SessionState {
  session: SessionData | null;
  isLoading: boolean;
  error: string | null;
  isAiTyping: boolean;
  
  initializeSession: (sessionId: string) => Promise<void>;
  verifyIdentity: (name: string, dob: string) => boolean;
  setMode: (mode: 'chat' | 'voice') => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  setAiTyping: (isTyping: boolean) => void;
  completeCurrentSection: (assessment?: string, nextSectionId?: string) => void;
  completeSession: () => void;
}

// Mock initial data
const MOCK_SESSION: SessionData = {
  id: 'mock-session-1',
  patientName: 'Jane Doe',
  procedureName: 'Lumbar Puncture',
  dateOfBirth: '1980-05-15',
  mode: 'chat',
  status: 'pending',
  messages: [],
  sections: [
    { id: 's1', title: 'Procedure Overview', status: 'pending' },
    { id: 's2', title: 'Risks and Side Effects', status: 'pending' },
    { id: 's3', title: 'Alternatives', status: 'pending' },
    { id: 's4', title: 'Recovery and Aftercare', status: 'pending' },
  ],
};

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  isLoading: false,
  error: null,
  isAiTyping: false,

  initializeSession: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    // In a real app, fetch from API
    setTimeout(() => {
      set({ session: { ...MOCK_SESSION, id: sessionId }, isLoading: false });
    }, 800);
  },

  verifyIdentity: (name: string, dob: string) => {
    const { session } = get();
    if (!session) return false;
    
    // Simple mock verification
    if (name.toLowerCase() === session.patientName.toLowerCase() && dob === session.dateOfBirth) {
      set({ session: { ...session, status: 'in-progress' } });
      return true;
    }
    return false;
  },

  setMode: (mode: 'chat' | 'voice') => {
    const { session } = get();
    if (session) {
      set({ session: { ...session, mode } });
    }
  },

  addMessage: (msg) => {
    const { session } = get();
    if (!session) return;
    
    const newMessage: Message = {
      ...msg,
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
    };
    
    set({
      session: {
        ...session,
        messages: [...session.messages, newMessage],
      },
    });
  },

  setAiTyping: (isTyping: boolean) => {
    set({ isAiTyping: isTyping });
  },

  completeCurrentSection: (assessment?: string, nextSectionId?: string) => {
    const { session } = get();
    if (!session) return;

    const currentSectionIndex = session.sections.findIndex(s => s.status === 'active');
    if (currentSectionIndex === -1) {
      // Set first pending to active
      const nextPendingIndex = session.sections.findIndex(s => s.status === 'pending');
      if (nextPendingIndex !== -1) {
        const newSections = [...session.sections];
        newSections[nextPendingIndex] = { ...newSections[nextPendingIndex], status: 'active' };
        set({ session: { ...session, sections: newSections } });
      }
      return;
    }

    const newSections = [...session.sections];
    newSections[currentSectionIndex] = {
      ...newSections[currentSectionIndex],
      status: 'completed',
      aiAssessment: assessment,
    };

    if (nextSectionId) {
      const nextIndex = newSections.findIndex(s => s.id === nextSectionId);
      if (nextIndex !== -1) {
        newSections[nextIndex] = { ...newSections[nextIndex], status: 'active' };
      }
    } else {
      // Find next pending
      const nextPendingIndex = newSections.findIndex(s => s.status === 'pending');
      if (nextPendingIndex !== -1) {
        newSections[nextPendingIndex] = { ...newSections[nextPendingIndex], status: 'active' };
      }
    }

    set({ session: { ...session, sections: newSections } });
  },

  completeSession: () => {
    const { session } = get();
    if (session) {
      set({ session: { ...session, status: 'completed' } });
    }
  },
}));
