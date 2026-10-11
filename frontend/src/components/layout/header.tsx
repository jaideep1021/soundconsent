import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { LogOut } from "lucide-react";
import { useCoordinator } from "@/hooks/use-coordinator";
import { backendApi } from "@/lib/backend-api";
import { apiError } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { Button } from "@/components/ui/button";
export function Header() {
  const account = useCoordinator();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <header data-dashboard-header className="border-b border-border bg-cream px-4 sm:px-6 py-3 shrink-0">
    <div className="flex items-center justify-between gap-4 min-h-11">
      <Link to="/dashboard/settings" className="min-w-0 text-sm underline truncate" aria-label="Account settings">{account.data?.name}</Link>
      <Button variant="outline" className="ml-auto shrink-0" disabled={busy} onClick={async () => {
        if (busy) return; setBusy(true); setError("");
        try { await backendApi.logout(); queryClient.clear(); queryClient.setQueryData(["auth"], null); navigate("/login", { replace: true }); }
        catch (e) { setError(apiError(e)); } finally { setBusy(false); }
      }}><LogOut className="size-4" />Sign out</Button>
    </div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </header>;
}
