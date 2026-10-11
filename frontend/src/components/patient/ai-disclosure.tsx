import React from 'react';
import { Bot } from 'lucide-react';

export const AiDisclosure: React.FC = () => {
  return (
    <div className="bg-[#f7f4ed] border border-[#eceae4] rounded-xl p-4 flex gap-4 items-start shadow-sm mb-8">
      <div className="bg-[#eceae4] text-[#1c1c1c] p-2 rounded-full shrink-0">
        <Bot className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-semibold text-[#1c1c1c] mb-1">Hi, I'm an AI assistant</h3>
        <p className="text-sm text-[#5f5f5d] leading-relaxed">
          I am here to help you review your consent document and answer basic questions. 
          <strong> I am not a doctor or a nurse.</strong> Any medical questions or concerns 
          will be flagged for your care team.
        </p>
      </div>
    </div>
  );
};
