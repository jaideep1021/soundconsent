import React, { useState } from "react";
import { ArrowUp, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  onVoiceClick?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled,
  onVoiceClick,
}) => {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled) {
      onSendMessage(text.trim());
      setText("");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 p-2 bg-off-white border border-border rounded-full focus-within:border-border-interactive transition-colors shadow-sm"
    >
      <input
        type="text"
        aria-label="Your response or question"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your response or question..."
        disabled={disabled}
        className="min-w-0 flex-1 bg-transparent px-4 py-2 text-sm text-charcoal placeholder-muted-foreground focus:outline-none"
      />
      {onVoiceClick && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onVoiceClick}
          className="h-11 w-11 text-muted-foreground hover:text-charcoal rounded-full"
          aria-label="Switch to Voice"
        >
          <Mic className="w-4 h-4" />
        </Button>
      )}
      <Button
        type="submit"
        size="icon"
        disabled={!text.trim() || disabled}
        className="h-11 w-11 bg-charcoal text-off-white rounded-full disabled:opacity-40 hover:bg-charcoal/90 transition-opacity"
        aria-label="Send message"
      >
        <ArrowUp className="w-4 h-4" />
      </Button>
    </form>
  );
};
