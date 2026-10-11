export function LoadingSkeleton() {
  return (
    <div role="status" className="w-full space-y-4 p-8">
      <span className="sr-only">Loading…</span>
      {[1, 2, 3].map((n) => (
        <div key={n} className="h-12 rounded-xl bg-muted animate-pulse" />
      ))}
    </div>
  );
}
