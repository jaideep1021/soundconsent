import React from 'react';
import { Bot, User } from 'lucide-react';
import type { Message } from '@/types/session';

interface ChatBubbleProps {
  message: Message;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isAi = message.role === 'ai';

  return (
    <div className={`flex w-full ${isAi ? 'justify-start' : 'justify-end'} mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`flex gap-3 max-w-[85%] ${isAi ? 'flex-row' : 'flex-row-reverse'}`}>
        {/* Avatar */}
        <div className="shrink-0 mt-1">
          {isAi ? (
            <div className="w-8 h-8 rounded-full bg-[#eceae4] flex items-center justify-center text-[#1c1c1c]">
              <Bot className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#1c1c1c] flex items-center justify-center text-[#fcfbf8]">
              <User className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Bubble */}
        <div className="flex flex-col gap-1">
          <div className={`flex items-center gap-2 ${isAi ? 'justify-start' : 'justify-end'}`}>
            <span className="text-xs font-medium text-[#1c1c1c]">
              {isAi ? 'AI Assistant' : 'You'}
            </span>
            <span className="text-[10px] text-[#5f5f5d]">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
          
          <div className={`p-4 rounded-2xl text-[15px] leading-relaxed ${
            isAi 
              ? 'bg-[#fcfbf8] border border-[#eceae4] text-[#1c1c1c] rounded-tl-sm' 
              : 'bg-[#eceae4] text-[#1c1c1c] rounded-tr-sm'
          }`}>
            {message.content}
          </div>
        </div>
      </div>
    </div>
  );
};
