import { apiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
export function QueryState({ pending, error, retry }: { pending: boolean; error: unknown; retry: () => unknown }) {
  if (pending) return <p role="status">Loading…</p>;
  if (error) return <div className="space-y-3"><p role="alert">{apiError(error)}</p><Button variant="outline" onClick={() => void retry()}>Try again</Button></div>;
  return null;
}
