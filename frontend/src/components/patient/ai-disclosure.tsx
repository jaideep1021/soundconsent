import React from "react";
import { Bot } from "lucide-react";

export const AiDisclosure: React.FC<{ disclosure: string }> = ({ disclosure }) => {
  return (
    <div className="bg-cream border border-border rounded-xl p-4 flex gap-4 items-start shadow-none mb-8">
      <div className="bg-border text-charcoal p-2 rounded-full shrink-0">
        <Bot className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-semibold text-charcoal mb-1">
          Hi, I'm an AI assistant
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {disclosure}
        </p>
      </div>
    </div>
  );
};
