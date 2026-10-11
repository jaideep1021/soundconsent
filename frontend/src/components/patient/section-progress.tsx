import React from "react";
import type { Section } from "@/types/session";
import { Check } from "lucide-react";

interface SectionProgressProps {
  sections: Section[];
  currentSectionId?: string;
}

export const SectionProgress: React.FC<SectionProgressProps> = ({
  sections,
  currentSectionId,
}) => {
  const completedCount = sections.filter(
    (s) => s.status === "completed" || s.status === "needs-review",
  ).length;
  const progressPercent = sections.length
    ? Math.round((completedCount / sections.length) * 100)
    : 0;

  return (
    <div className="space-y-4 mb-6">
      {/* Visual progress bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Progress</span>
        <span>
          {completedCount} of {sections.length} reviewed
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Sections reviewed"
        aria-valuemin={0}
        aria-valuemax={sections.length}
        aria-valuenow={completedCount}
        className="w-full h-2 bg-progress-track rounded-full overflow-hidden"
      >
        <div
          className="h-full bg-charcoal transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Chips */}
      <div
        role="region"
        aria-label="Review sections"
        tabIndex={0}
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-none"
      >
        {sections.map((section, idx) => {
          const isActive = section.id === currentSectionId;
          const isCompleted = section.status === "completed";

          return (
            <div
              key={section.id}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
                isActive
                  ? "border-charcoal bg-charcoal text-off-white"
                  : isCompleted
                    ? "border-border bg-border text-charcoal"
                    : "border-border text-muted-foreground"
              }`}
            >
              {isCompleted ? (
                <Check className="w-3 h-3 text-charcoal" />
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
