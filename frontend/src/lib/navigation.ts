export function coordinatorDestination(value: unknown): string {
  return typeof value === "string" && /^\/dashboard(?:[/?]|$)/.test(value) ? value : "/dashboard";
}
export function legacyWorkspaceDestination(search: string): string {
  const id = new URLSearchParams(search).get("session");
  return id ? `/dashboard/sessions/${encodeURIComponent(id)}` : "/dashboard";
}
