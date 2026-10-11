import React, { useState } from 'react';
import { ArrowUp, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  onVoiceClick?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled, onVoiceClick }) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled) {
      onSendMessage(text.trim());
      setText('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2 bg-[#fcfbf8] border border-[#eceae4] rounded-full focus-within:border-[rgba(28,28,28,0.4)] transition-colors shadow-sm">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your response or question..."
        disabled={disabled}
        className="flex-1 bg-transparent px-4 py-2 text-sm text-[#1c1c1c] placeholder-[#5f5f5d] focus:outline-none"
      />
      {onVoiceClick && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onVoiceClick}
          className="h-10 w-10 text-[#5f5f5d] hover:text-[#1c1c1c] rounded-full"
          aria-label="Switch to Voice"
        >
          <Mic className="w-4 h-4" />
        </Button>
      )}
      <Button
        type="submit"
        size="icon"
        disabled={!text.trim() || disabled}
        className="h-10 w-10 bg-[#1c1c1c] text-[#fcfbf8] rounded-full disabled:opacity-40 hover:bg-[#1c1c1c]/90 transition-opacity"
        aria-label="Send message"
      >
        <ArrowUp className="w-4 h-4" />
      </Button>
    </form>
  );
};
