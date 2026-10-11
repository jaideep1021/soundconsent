import { useParams, useNavigate } from 'react-router';
import { useSessionStore } from '@/stores/session-store';
import { AiDisclosure } from '@/components/patient/ai-disclosure';
import { MessageSquare, Mic } from 'lucide-react';

export default function SessionOverviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, setMode } = useSessionStore();

  if (!session) {
    navigate(`/session/${sessionId}`);
    return null;
  }

  const handleStart = (mode: 'chat' | 'voice') => {
    setMode(mode);
    navigate(`/session/${sessionId}/${mode}`);
  };

  return (
    <div className="flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      <div className="space-y-3">
        <h1 className="text-[36px] font-semibold text-[#1c1c1c] tracking-[-0.9px] leading-tight">
          Reviewing your procedure
        </h1>
        <p className="text-lg text-[#5f5f5d]">
          {session.procedureName}
        </p>
      </div>

      <AiDisclosure />

      <div className="space-y-4">
        <h2 className="text-[20px] font-semibold text-[#1c1c1c]">What we'll cover:</h2>
        <ul className="space-y-3">
          {session.sections.map((section, index) => (
            <li key={section.id} className="flex gap-3 text-[#1c1c1c]">
              <span className="text-[#5f5f5d] w-6 text-right shrink-0">{index + 1}.</span>
              <span>{section.title}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="pt-8 border-t border-[#eceae4] space-y-6">
        <h2 className="text-[20px] font-semibold text-[#1c1c1c]">How would you like to proceed?</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={() => handleStart('chat')}
            className="flex flex-col items-center p-6 bg-[#f7f4ed] border border-[#eceae4] rounded-xl hover:border-[rgba(28,28,28,0.4)] transition-colors text-left gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]"
          >
            <div className="w-12 h-12 bg-[#eceae4] rounded-full flex items-center justify-center text-[#1c1c1c]">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div className="text-center">
              <div className="font-semibold text-[#1c1c1c] mb-1">Text Chat</div>
              <div className="text-sm text-[#5f5f5d]">Read and type your responses</div>
            </div>
          </button>

          <button 
            onClick={() => handleStart('voice')}
            className="flex flex-col items-center p-6 bg-[#f7f4ed] border border-[#eceae4] rounded-xl hover:border-[rgba(28,28,28,0.4)] transition-colors text-left gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]"
          >
            <div className="w-12 h-12 bg-[#eceae4] rounded-full flex items-center justify-center text-[#1c1c1c]">
              <Mic className="w-6 h-6" />
            </div>
            <div className="text-center">
              <div className="font-semibold text-[#1c1c1c] mb-1">Voice Chat</div>
              <div className="text-sm text-[#5f5f5d]">Talk naturally, like a phone call</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
