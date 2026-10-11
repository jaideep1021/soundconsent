import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useSessionStore } from '@/stores/session-store';
import { ConsentSignature } from '@/components/patient/consent-signature';
import { CheckCircle2, AlertTriangle, FileText } from 'lucide-react';

export default function SessionSummaryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, completeSession } = useSessionStore();
  
  const [isConsented, setIsConsented] = useState(false);

  if (!session) {
    navigate(`/session/${sessionId}`);
    return null;
  }

  const handleConsent = (_signature: string) => {
    completeSession();
    setIsConsented(true);
  };

  if (isConsented) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="w-20 h-20 bg-[#eceae4] rounded-full flex items-center justify-center text-[#1c1c1c]">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-[36px] font-semibold text-[#1c1c1c] tracking-[-0.9px] leading-tight">
            Thank You
          </h1>
          <p className="text-lg text-[#5f5f5d] max-w-md mx-auto">
            Your consent for {session.procedureName} has been successfully recorded. You may now close this window or return the device to your care team.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      <div className="space-y-3">
        <h1 className="text-[36px] font-semibold text-[#1c1c1c] tracking-[-0.9px] leading-tight">
          Review & Consent
        </h1>
        <p className="text-lg text-[#5f5f5d]">
          You've completed the review of {session.procedureName}. Below is a summary of what we discussed.
        </p>
      </div>

      <div className="space-y-4">
        {session.sections.map((section, idx) => (
          <div key={section.id} className="bg-[#fcfbf8] border border-[#eceae4] rounded-xl p-5 flex gap-4">
            <div className="shrink-0 mt-0.5">
              {section.status === 'completed' ? (
                <CheckCircle2 className="w-5 h-5 text-[#1c1c1c]" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-[#ef4444]" />
              )}
            </div>
            <div>
              <h4 className="font-medium text-[#1c1c1c]">
                {idx + 1}. {section.title}
              </h4>
              <p className="text-sm text-[#5f5f5d] mt-1 leading-relaxed">
                {section.status === 'completed' 
                  ? "We reviewed this and you demonstrated a clear understanding."
                  : "We didn't fully complete this section. You can still consent, but your care team may discuss this further with you."}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#f7f4ed] border border-[#eceae4] rounded-xl p-5 flex gap-4">
        <FileText className="w-5 h-5 text-[#1c1c1c] shrink-0" />
        <div className="text-sm text-[#1c1c1c] leading-relaxed">
          <strong>Key Takeaway:</strong> You understand that this procedure is to help diagnose your condition, you are aware of the risks including minor bleeding, and you know to contact the clinic if you experience severe pain afterward.
        </div>
      </div>

      <div className="pt-4">
        <ConsentSignature 
          patientName={session.patientName} 
          onConsent={handleConsent} 
        />
      </div>
    </div>
  );
}
