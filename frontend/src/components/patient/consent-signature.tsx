import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ConsentSignatureProps {
  patientName: string;
  onConsent: (signature: string) => void;
}

export const ConsentSignature: React.FC<ConsentSignatureProps> = ({ patientName, onConsent }) => {
  const [agreed, setAgreed] = useState(false);
  const [typedName, setTypedName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (agreed && typedName.trim().toLowerCase() === patientName.toLowerCase()) {
      onConsent(typedName);
    }
  };

  const isComplete = agreed && typedName.trim().toLowerCase() === patientName.toLowerCase();

  return (
    <div className="bg-[#fcfbf8] border border-[#eceae4] rounded-xl p-6 space-y-6">
      <h3 className="text-lg font-semibold text-[#1c1c1c]">Digital Consent</h3>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="mt-1 flex items-center justify-center">
            <input 
              type="checkbox" 
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-5 h-5 rounded border-[#eceae4] text-[#1c1c1c] focus:ring-[#1c1c1c] accent-[#1c1c1c]"
            />
          </div>
          <span className="text-[#1c1c1c] leading-relaxed select-none group-hover:text-[#1c1c1c]/80 transition-colors">
            I confirm that I have reviewed all the information about the procedure. All my questions have been answered, and I give my consent to proceed.
          </span>
        </label>

        <div className="space-y-2">
          <label htmlFor="signature" className="text-sm font-medium text-[#1c1c1c] block">
            Type your full name to sign (<span className="font-semibold">{patientName}</span>)
          </label>
          <Input
            id="signature"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={`e.g. ${patientName}`}
            className="bg-[#f7f4ed] border-[#eceae4] focus-visible:ring-[#3b82f6] text-base h-12"
          />
        </div>

        <Button 
          type="submit" 
          disabled={!isComplete}
          className="w-full bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90 rounded-[6px] h-12 text-base shadow-[var(--shadow-inset-button)] disabled:opacity-50 transition-opacity"
        >
          I Understand and Consent
        </Button>
      </form>
    </div>
  );
};
