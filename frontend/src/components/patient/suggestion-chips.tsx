import React from 'react';

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}

export const SuggestionChips: React.FC<SuggestionChipsProps> = ({ suggestions, onSelect }) => {
  if (!suggestions.length) return null;

  return (
    <div className="flex gap-2 overflow-x-auto py-2 px-1 scrollbar-none animate-in fade-in slide-in-from-bottom-2">
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => onSelect(suggestion)}
          className="whitespace-nowrap px-4 py-2 rounded-full border border-[#eceae4] bg-[#f7f4ed] hover:border-[rgba(28,28,28,0.4)] text-sm text-[#1c1c1c] transition-colors focus:outline-none focus:ring-1 focus:ring-[#1c1c1c]"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
};
