import { useParams, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Mic, ArrowLeft } from 'lucide-react';

export default function SessionVoicePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center animate-in fade-in duration-500">
      <div className="w-24 h-24 rounded-full bg-[#eceae4] flex items-center justify-center text-[#1c1c1c] animate-pulse">
        <Mic className="w-10 h-10" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-[#1c1c1c]">Voice Mode</h2>
        <p className="text-[#5f5f5d] max-w-sm">
          Voice mode is being prepared. You can switch back to text chat at any time.
        </p>
      </div>
      <Button
        onClick={() => navigate(`/session/${sessionId}/chat`)}
        variant="outline"
        className="gap-2 border-[rgba(28,28,28,0.4)] text-[#1c1c1c] rounded-[6px]"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Text Chat</span>
      </Button>
    </div>
  );
}
