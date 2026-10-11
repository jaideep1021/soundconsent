import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useParams } from "react-router";
import { ShieldCheck } from "lucide-react";
import { backendApi, type BackendSnapshot } from "@/lib/backend-api";
import { apiError, isUnauthorized } from "@/lib/api-client";
import type { PatientSessionContext } from "@/hooks/patient-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function PatientLayout() {
  const { sessionId = "" } = useParams();
  return <PatientSession key={sessionId} sessionId={sessionId} />;
}
function PatientSession({ sessionId }: { sessionId: string }) {
  const location = useLocation();
  const [token, setToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("invite") ?? "");
  const [code, setCode] = useState("");
  const [snapshot, setSnapshot] = useState<BackendSnapshot | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const onAccessDenied = useCallback(() => { setSnapshot(null); setBusy(false); setError("Your access expired or was revoked. Ask your coordinator for a new invitation."); }, []);
  const refresh = useCallback(async () => { try { setSnapshot(await backendApi.session(sessionId)); } catch (e) { if (isUnauthorized(e)) onAccessDenied(); throw e; } }, [sessionId, onAccessDenied]);
  useEffect(() => {
    // Strip invitation credentials before any further navigation. Keep them only in memory until exchange.
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }, []);
  useEffect(() => {
    let active = true;
    backendApi.session(sessionId).then((next) => { if (active) setSnapshot(next); }).catch((e: unknown) => {
      if (active) { if (isUnauthorized(e)) setSnapshot(null); else setError(apiError(e)); }
    }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [sessionId, location.pathname]);
  return <div className="min-h-dvh bg-cream text-charcoal flex flex-col font-sans">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-charcoal focus:text-off-white focus:rounded-md">Skip to main content</a>
    <header className="border-b border-border px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
      <Link to="/" className="flex items-center gap-2"><ShieldCheck className="size-5" /><span className="font-semibold text-lg tracking-tight">Teach-It-Back</span></Link>
      {snapshot && <Button variant="outline" disabled={busy || submitting} onClick={async () => {
        setSubmitting(true); setError("");
        try { await backendApi.patientLogout(sessionId); setSnapshot(null); setCode(""); setToken(""); }
        catch (e) { setError(apiError(e)); } finally { setSubmitting(false); }
      }}>Sign out of review</Button>}
    </header>
    <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col max-w-3xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {checking ? <p role="status">Checking access…</p> : snapshot ? <>
        <nav aria-label="Review navigation" className="flex flex-wrap gap-3 border-b pb-4">
          {[['overview', 'Overview'], ['chat', 'Text Chat'], ['voice', 'Voice'], ...(snapshot.status === 'completed' ? [['summary', 'Summary']] : [])].map(([path, label]) => busy ? <span key={path} className="px-3 py-2 text-muted-foreground" aria-disabled="true">{label}</span> : <NavLink key={path} className={({ isActive }) => `min-h-11 inline-flex items-center px-3 rounded-md ${isActive ? 'bg-charcoal text-off-white' : 'underline'}`} to={`/session/${encodeURIComponent(sessionId)}/${path}`}>{label}</NavLink>)}
        </nav>
        <Outlet context={{ snapshot, refresh, setSnapshot, onAccessDenied, setBusy } satisfies PatientSessionContext} />
      </> : <div className="w-full max-w-md mx-auto py-8 space-y-6">
        <h1 className="text-3xl font-semibold">Welcome</h1><p className="text-muted-foreground">Use the invitation link and separate access code your coordinator provided to open your understanding review.</p>
        {!token && <p>Open your unused invitation link. If it has expired or was already used, ask your coordinator for a new one.</p>}
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault(); if (submitting) return; setSubmitting(true); setError("");
          try { await backendApi.exchange(sessionId, token, code); setToken(""); setCode(""); await refresh(); }
          catch (err) { setError(apiError(err)); } finally { setSubmitting(false); }
        }}><label className="block" htmlFor="patient-code">Access code</label><Input id="patient-code" type="password" autoComplete="off" required disabled={submitting} value={code} onChange={(e) => setCode(e.target.value)} /><Button type="submit" disabled={submitting || !token}>Open review</Button></form>
        <p className="text-sm text-muted-foreground">This grants access to the review. It does not record consent to participate.</p>
      </div>}
    </main>
  </div>;
}
