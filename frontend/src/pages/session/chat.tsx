import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useSessionStore } from '@/stores/session-store';
import { SectionProgress } from '@/components/patient/section-progress';
import { ChatBubble } from '@/components/patient/chat-bubble';
import { TypingIndicator } from '@/components/patient/typing-indicator';
import { ChatInput } from '@/components/patient/chat-input';
import { SuggestionChips } from '@/components/patient/suggestion-chips';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

const SAMPLE_QUESTIONS: Record<string, { prompt: string; suggestions: string[] }> = {
  s1: {
    prompt: "Let's start with the procedure itself. Can you explain in your own words why you are having this procedure done?",
    suggestions: ["To help diagnose my condition", "My doctor recommended it", "I'm not fully sure"],
  },
  s2: {
    prompt: "Every procedure carries some risks. What are some of the potential side effects or risks that were mentioned to you?",
    suggestions: ["Headache or soreness", "Infection or bleeding", "Could you remind me?"],
  },
  s3: {
    prompt: "Were any alternative options or treatments discussed with you before choosing this?",
    suggestions: ["Yes, waiting or medication", "No other options were given", "I chose this directly"],
  },
  s4: {
    prompt: "Finally, what should you do after the procedure if you don't feel well?",
    suggestions: ["Call the clinic or emergency", "Rest and take fluids", "I'm not sure of the number"],
  },
};

export default function SessionChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { 
    session, 
    addMessage, 
    isAiTyping, 
    setAiTyping, 
    completeCurrentSection 
  } = useSessionStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [session?.messages, isAiTyping]);

  // Initial welcome message
  useEffect(() => {
    if (session && session.messages.length === 0) {
      setAiTyping(true);
      setTimeout(() => {
        addMessage({
          role: 'ai',
          content: `Hello ${session.patientName}. I'm here to walk you through your consent form for the ${session.procedureName}. Let's make sure everything is clear and that you feel comfortable.`,
        });

        // Trigger first section prompt
        setTimeout(() => {
          const firstSection = session.sections[0];
          if (firstSection) {
            addMessage({
              role: 'ai',
              content: SAMPLE_QUESTIONS[firstSection.id]?.prompt || "Can you describe what you understand about this section?",
            });
          }
          setAiTyping(false);
        }, 1000);
      }, 1000);
    }
  }, [session, addMessage, setAiTyping]);

  if (!session) {
    navigate(`/session/${sessionId}`);
    return null;
  }

  const currentSection = session.sections[currentSectionIndex];
  const allCompleted = session.sections.every(s => s.status === 'completed');

  const handleSendMessage = (text: string) => {
    addMessage({ role: 'patient', content: text });
    setAiTyping(true);

    // Simulate AI evaluation & response
    setTimeout(() => {
      addMessage({
        role: 'ai',
        content: "Thank you for sharing that. That makes total sense and matches what we have on record.",
      });

      // Complete current section
      completeCurrentSection("Patient showed full understanding.");

      if (currentSectionIndex < session.sections.length - 1) {
        const nextIndex = currentSectionIndex + 1;
        setCurrentSectionIndex(nextIndex);
        const nextSection = session.sections[nextIndex];
        
        setTimeout(() => {
          addMessage({
            role: 'ai',
            content: SAMPLE_QUESTIONS[nextSection.id]?.prompt || "Moving on, what are your thoughts on the next section?",
          });
          setAiTyping(false);
        }, 1000);
      } else {
        setTimeout(() => {
          addMessage({
            role: 'ai',
            content: "You've completed all sections! You are now ready to review your summary and complete your consent.",
          });
          setAiTyping(false);
        }, 1000);
      }
    }, 1500);
  };

  const currentSuggestions = currentSection ? SAMPLE_QUESTIONS[currentSection.id]?.suggestions || [] : [];

  return (
    <div className="flex flex-col flex-1 h-[calc(100vh-100px)] max-h-[850px]">
      {/* Progress */}
      <SectionProgress 
        sections={session.sections} 
        currentSectionId={currentSection?.id} 
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-1 py-4 space-y-4">
        {session.messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        {isAiTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer / Input Area */}
      <div className="pt-2 border-t border-[#eceae4] flex flex-col gap-2">
        {allCompleted ? (
          <div className="p-4 bg-[#fcfbf8] border border-[#eceae4] rounded-xl flex items-center justify-between animate-in fade-in">
            <div>
              <h4 className="font-semibold text-[#1c1c1c]">All sections reviewed</h4>
              <p className="text-sm text-[#5f5f5d]">You can now view your summary and sign the consent.</p>
            </div>
            <Button
              onClick={() => navigate(`/session/${sessionId}/summary`)}
              className="bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90 rounded-[6px] gap-2 shadow-[var(--shadow-inset-button)]"
            >
              <span>Summary</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <>
            <SuggestionChips 
              suggestions={currentSuggestions} 
              onSelect={handleSendMessage} 
            />
            <ChatInput 
              onSendMessage={handleSendMessage} 
              disabled={isAiTyping}
              onVoiceClick={() => navigate(`/session/${sessionId}/voice`)}
            />
          </>
        )}
      </div>
    </div>
  );
}
