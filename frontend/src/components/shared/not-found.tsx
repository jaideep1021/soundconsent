import { Link } from "react-router";
export function NotFound({
  title = "Page not found",
  message = "Check the link or return to the home page.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">{message}</p>
      <Link to="/" className="inline-flex min-h-11 items-center underline">
        Return home
      </Link>
    </div>
  );
}
