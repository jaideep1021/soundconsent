import React from 'react';
import { Bot } from 'lucide-react';

export const TypingIndicator: React.FC = () => {
  return (
    <div className="flex w-full justify-start mb-4 animate-in fade-in duration-300">
      <div className="flex gap-3 max-w-[85%]">
        <div className="shrink-0 mt-1">
          <div className="w-8 h-8 rounded-full bg-[#eceae4] flex items-center justify-center text-[#1c1c1c]">
            <Bot className="w-4 h-4" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#1c1c1c]">AI Assistant</span>
          </div>
          
          <div className="p-4 py-5 rounded-2xl bg-[#fcfbf8] border border-[#eceae4] rounded-tl-sm flex gap-1.5 items-center w-fit">
            <div className="w-1.5 h-1.5 bg-[#5f5f5d] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-1.5 h-1.5 bg-[#5f5f5d] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-1.5 h-1.5 bg-[#5f5f5d] rounded-full animate-bounce"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
