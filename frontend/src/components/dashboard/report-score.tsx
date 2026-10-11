export function ReportScore({
  passed,
  total,
}: {
  passed: number;
  total: number;
}) {
  const percent = total ? Math.round((passed / total) * 100) : 0;
  return (
    <div
      className="relative size-28 shrink-0"
      role="img"
      aria-label={`${passed} of ${total} sections assessed as passed (${percent} percent)`}
    >
      <svg
        viewBox="0 0 100 100"
        className="size-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="var(--color-progress-track)"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="var(--foreground)"
          strokeWidth="8"
          pathLength="100"
          strokeDasharray={`${percent} 100`}
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center text-2xl font-semibold"
      >
        {percent}%
      </span>
    </div>
  );
}
