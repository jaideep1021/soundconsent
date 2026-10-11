import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { CoordinatorLogin } from "@/components/auth/login-form";
import { useCoordinator } from "@/hooks/use-coordinator";
import { queryClient } from "@/lib/query-client";
import { coordinatorDestination } from "@/lib/navigation";
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const account = useCoordinator();
  const destination = coordinatorDestination(location.state?.from);
  if (account.data) return <Navigate to={destination} replace />;
  return <main className="max-w-lg mx-auto p-4 py-12 space-y-6">
    <Link className="underline" to="/">Teach-It-Back</Link>
    <h1 className="text-3xl font-semibold">Coordinator sign in</h1>
    <p className="text-muted-foreground">Access your study documents, sessions and follow-ups.</p>
    <CoordinatorLogin onLogin={(user) => { queryClient.clear(); queryClient.setQueryData(["auth"], user); navigate(destination, { replace: true }); }} />
    <Link className="underline" to="/patient">I have a patient invitation</Link>
  </main>;
}
