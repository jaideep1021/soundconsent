import React from "react";
import { Outlet } from "react-router";
import { ShieldCheck } from "lucide-react";

export const PatientLayout: React.FC = () => {
  return (
    <div className="min-h-dvh bg-cream text-charcoal flex flex-col font-sans">
      {/* Accessible skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-charcoal focus:text-off-white focus:rounded-[6px]"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-charcoal" />
          <span className="font-semibold text-lg tracking-tight">
            Teach-It-Back
          </span>
        </div>
        <div className="text-sm text-muted-foreground">Consent Companion</div>
      </header>

      {/* Main Content */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 flex flex-col max-w-2xl w-full mx-auto p-4 sm:p-6 md:p-8"
      >
        <p className="mb-4 text-xs text-muted-foreground">
          Frontend demo · Responses stay in this browser tab. No clinical
          assessment is performed.
        </p>
        <Outlet />
      </main>
    </div>
  );
};
