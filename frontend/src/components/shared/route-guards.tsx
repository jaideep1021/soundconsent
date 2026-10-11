import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router";
import { useAuthStore } from "@/stores/auth-store";
import { useSessionStore } from "@/stores/session-store";
import { NotFound } from "./not-found";
import { LoadingSkeleton } from "./loading-skeleton";
export function ProtectedRoute() {
  const authenticated = useAuthStore(
    (s) => s.isAuthenticated && !!s.token && !!s.user,
  );
  const location = useLocation();
  return authenticated ? (
    <Outlet />
  ) : (
    <Navigate to="/login" state={{ from: location.pathname }} replace />
  );
}
export function SessionRoute() {
  const { sessionId } = useParams();
  const location = useLocation();
  const { session, records, verifiedSessionId, initializeSession } =
    useSessionStore();
  useEffect(() => {
    if (sessionId) initializeSession(sessionId);
  }, [sessionId, initializeSession]);
  if (!records.some((s) => s.id === sessionId))
    return (
      <NotFound
        title="Session unavailable"
        message="This demo link is invalid or no longer stored in this tab. Ask your coordinator for a new link."
      />
    );
  if (!session || session.id !== sessionId) return <LoadingSkeleton />;
  const base = `/session/${sessionId}`;
  const pathname = location.pathname.replace(/\/$/, "");
  if (verifiedSessionId !== sessionId && pathname !== base)
    return <Navigate to={base} replace />;
  if (
    verifiedSessionId === sessionId &&
    session.status === "completed" &&
    pathname !== `${base}/summary`
  )
    return <Navigate to={`${base}/summary`} replace />;
  if (
    pathname === `${base}/summary` &&
    session.sections.some(
      (s) => s.status === "pending" || s.status === "active",
    )
  )
    return <Navigate to={`${base}/chat`} replace />;
  return <Outlet />;
}
