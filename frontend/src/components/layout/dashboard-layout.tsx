import { SkipToContent } from "@/components/shared/skip-to-content";
import { Outlet } from "react-router";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

export function DashboardLayout() {
  return (
    <div
      data-dashboard-shell
      className="flex flex-col md:flex-row h-dvh bg-cream overflow-hidden text-charcoal font-sans"
    >
      <SkipToContent />
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <Header />
        <main
          data-dashboard-main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto p-4 sm:p-8"
        >
          <p data-demo-banner className="mb-6 text-sm text-muted-foreground">
            Frontend demo · Use sample details only. Changes stay in this
            browser tab.
          </p>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
