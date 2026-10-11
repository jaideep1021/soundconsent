import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useLocation, useParams, useNavigate } from "react-router";
import { ShieldCheck } from "lucide-react";
import { backendApi, type BackendSnapshot, type PatientUser } from "@/lib/backend-api";
import { apiError, isUnauthorized } from "@/lib/api-client";
import type { PatientSessionContext } from "@/hooks/patient-session";
import { Button } from "@/components/ui/button";
import { PatientLoginForm } from "@/components/auth/patient-login-form";
import { Input } from "@/components/ui/input";
export function PatientLayout() {
  const { sessionId = "" } = useParams();
  return <PatientSession key={sessionId} sessionId={sessionId} />;
}
function PatientSession({ sessionId }: { sessionId: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<PatientUser | null>(null);
  const [checkingUser, setCheckingUser] = useState(true);
  const [token, setToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("invite") ?? "");
  const [code, setCode] = useState("");
  const [snapshot, setSnapshot] = useState<BackendSnapshot | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; backendApi.patientMe().then((next) => { if (active) setUser(next); }).catch((e) => { if (active && !isUnauthorized(e)) setError(apiError(e)); }).finally(() => { if (active) setCheckingUser(false); }); return () => { active = false; }; }, []);
  const onAccessDenied = useCallback(() => { setSnapshot(null); setUser(null); setBusy(false); setError("Your access expired or was revoked. Sign in again to continue from My studies."); }, []);
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
  }, [sessionId, location.pathname, user?.id]);
  useEffect(() => {
    if (user && snapshot?.accessRole === "patient") void backendApi.claimPatientReview(sessionId).catch((e) => setError(apiError(e)));
  }, [user, snapshot?.accessRole, sessionId]);
  return <div className="min-h-dvh bg-cream text-charcoal flex flex-col font-sans">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-charcoal focus:text-off-white focus:rounded-md">Skip to main content</a>
    <header className="border-b border-border px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
      <Link to="/" className="flex items-center gap-2"><ShieldCheck className="size-5" /><span className="font-semibold text-lg tracking-tight">Teach-It-Back</span></Link>
      <div className="flex items-center gap-3"><Link className="underline" to="/patient">My studies</Link>
      {(snapshot || user) && <Button variant="outline" disabled={busy || submitting} onClick={async () => {
        setSubmitting(true); setError("");
        try { await backendApi.patientLogout(sessionId); await backendApi.patientSignOut(); setSnapshot(null); setUser(null); setCode(""); setToken(""); navigate("/patient"); }
        catch (e) { setError(apiError(e)); } finally { setSubmitting(false); }
      }}>Sign out</Button>}</div>
    </header>
    <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col max-w-3xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {checking || checkingUser ? <p role="status">Checking access…</p> : snapshot ? <>
        {snapshot.accessRole === "patient" && !user && <section className="border rounded-xl p-5 space-y-4"><p>Save this review to an account so you can return without a new invitation.</p><PatientLoginForm onSuccess={(next) => { setError(""); setUser(next); }} /></section>}
        <nav aria-label="Review navigation" className="flex flex-wrap gap-3 border-b pb-4">
          {[
            { path: "overview", label: "Overview", active: /\/overview\/?$/.test(location.pathname) },
            { path: snapshot.status === "completed" ? "summary" : "chat", label: "Review", active: /\/(chat|voice|summary)\/?$/.test(location.pathname) },
          ].map(({ path, label, active }) => busy ? <span key={label} className="px-3 py-2 text-muted-foreground" aria-disabled="true">{label}</span> : <Link key={label} aria-current={active ? "page" : undefined} className={`min-h-11 inline-flex items-center px-3 rounded-md ${active ? 'bg-charcoal text-off-white' : 'underline'}`} to={`/session/${encodeURIComponent(sessionId)}/${path}`}>{label}</Link>)}
        </nav>
        <Outlet context={{ snapshot, refresh, setSnapshot, onAccessDenied, setBusy } satisfies PatientSessionContext} />
      </> : <div className="w-full max-w-md mx-auto py-8 space-y-6">
        {!user ? <><PatientLoginForm onSuccess={(next) => { setError(""); setUser(next); }} />{token && <p className="text-sm">Sign in or create an account, then enter your invitation code to add this study.</p>}</> : token ? <>
        <h1 className="text-3xl font-semibold">Add your invited study</h1><p>Signed in as <strong>{user.username}</strong>. Enter the access code your coordinator provided. This study will stay on your homepage.</p>
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault(); if (submitting) return; setSubmitting(true); setError("");
          try { await backendApi.exchange(sessionId, token, code); setToken(""); setCode(""); navigate("/patient"); }
          catch (err) { if (isUnauthorized(err) && apiError(err) === "Patient sign in required") setUser(null); setError(apiError(err)); } finally { setSubmitting(false); }
        }}><label className="block" htmlFor="patient-code">Access code</label><Input id="patient-code" type="password" autoComplete="off" required disabled={submitting} value={code} onChange={(e) => setCode(e.target.value)} /><Button type="submit" disabled={submitting}>Add study to my homepage</Button></form>
        </> : <><h1 className="text-3xl font-semibold">Find your study</h1><p>Open an assigned study from your homepage. To add a new study, ask your coordinator to invite your username, <strong>{user.username}</strong>, or open your first-time invitation link.</p><Button asChild><Link to="/patient">Go to My studies</Link></Button></>}
        <p className="text-sm text-muted-foreground">This grants access to the review. It does not record consent to participate.</p>
      </div>}
    </main>
  </div>;
}
