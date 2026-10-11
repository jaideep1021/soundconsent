import { Navigate, Outlet, useLocation } from "react-router";
import { useCoordinator } from "@/hooks/use-coordinator";
import { apiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "./loading-skeleton";
export function ProtectedRoute() {
  const account = useCoordinator();
  const location = useLocation();
  if (account.isPending) return <LoadingSkeleton />;
  if (account.error) return <main className="p-8 space-y-4"><p role="alert">{apiError(account.error)}</p><Button onClick={() => void account.refetch()}>Retry sign-in check</Button></main>;
  return account.data ? <Outlet /> : <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
}
