import React from 'react';
import type { Section } from '@/types/session';
import { Check } from 'lucide-react';

interface SectionProgressProps {
  sections: Section[];
  currentSectionId?: string;
}

export const SectionProgress: React.FC<SectionProgressProps> = ({ sections, currentSectionId }) => {
  const completedCount = sections.filter(s => s.status === 'completed').length;
  const progressPercent = Math.round((completedCount / sections.length) * 100);

  return (
    <div className="space-y-4 mb-6">
      {/* Visual progress bar */}
      <div className="flex items-center justify-between text-xs text-[#5f5f5d]">
        <span>Progress</span>
        <span>{completedCount} of {sections.length} completed</span>
      </div>
      <div className="w-full h-1.5 bg-[#eceae4] rounded-full overflow-hidden">
        <div 
          className="h-full bg-[#1c1c1c] transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {sections.map((section, idx) => {
          const isActive = section.id === currentSectionId;
          const isCompleted = section.status === 'completed';

          return (
            <div
              key={section.id}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
                isActive
                  ? 'border-[#1c1c1c] bg-[#1c1c1c] text-[#fcfbf8]'
                  : isCompleted
                  ? 'border-[#eceae4] bg-[#eceae4] text-[#1c1c1c]'
                  : 'border-[#eceae4] text-[#5f5f5d]'
              }`}
            >
              {isCompleted ? (
                <Check className="w-3 h-3 text-[#1c1c1c]" />
              ) : (
                <span>{idx + 1}</span>
              )}
              <span>{section.title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
