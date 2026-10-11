import { Navigate, useLocation, useParams } from "react-router";
import { legacyWorkspaceDestination } from "@/lib/navigation";
export function WorkspaceRedirect() {
  return <Navigate to={legacyWorkspaceDestination(useLocation().search)} replace />;
}
export function PatientRedirect() {
  const { sessionId = "" } = useParams();
  const location = useLocation();
  return <Navigate to={`/session/${encodeURIComponent(sessionId)}${location.search}${location.hash}`} replace />;
}
export function LoginRedirect() {
  const location = useLocation();
  return <Navigate to="/login" state={location.state} replace />;
}
