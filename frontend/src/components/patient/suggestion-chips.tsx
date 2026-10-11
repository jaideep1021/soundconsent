import React from "react";

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}

export const SuggestionChips: React.FC<SuggestionChipsProps> = ({
  suggestions,
  onSelect,
}) => {
  if (!suggestions.length) return null;

  return (
    <div className="flex gap-2 overflow-x-auto py-2 px-1 scrollbar-none animate-in fade-in slide-in-from-bottom-2">
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => onSelect(suggestion)}
          className="min-h-11 whitespace-nowrap px-4 py-2 rounded-full border border-border bg-cream hover:border-border-interactive text-sm text-charcoal transition-colors focus:outline-none focus:ring-1 focus:ring-charcoal"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
};
