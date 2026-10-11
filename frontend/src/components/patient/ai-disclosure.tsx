import React from "react";
import { Bot } from "lucide-react";

export const AiDisclosure: React.FC = () => {
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
          This is a preview of an AI consent assistant. You can record responses
          and questions.
          <strong> I am not a doctor or a nurse.</strong> Any medical questions
          or concerns should be discussed with your care team. This demo does
          not send them notifications.
        </p>
      </div>
    </div>
  );
};
