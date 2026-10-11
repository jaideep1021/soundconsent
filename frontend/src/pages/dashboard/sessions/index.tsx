import { useState } from "react";
import { Link } from "react-router";
import { useSessionStore } from "@/stores/session-store";
import { SessionTable } from "@/components/dashboard/session-table";
import { sessionStatus } from "@/lib/session-status";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export default function SessionsPage() {
  const sessions = useSessionStore((s) => s.records);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const filtered = sessions.filter(
    (s) =>
      `${s.patientName} ${s.procedureName}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()) &&
      (status === "All" || sessionStatus(s) === status),
  );
  return (
    <div className="space-y-8">
      <div className="flex justify-between gap-4 flex-wrap">
        <h1 className="text-4xl font-semibold">Sessions</h1>
        <Button asChild>
          <Link to="/dashboard/sessions/new">New Session</Link>
        </Button>
      </div>
      <div className="flex gap-3 flex-wrap">
        <Input
          className="max-w-md"
          aria-label="Search sessions"
          placeholder="Search patients or sessions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter by status"
          className="h-11 border rounded-standard bg-cream px-3"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {["All", "Pending", "Active", "Needs Review", "Completed"].map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
        </select>
      </div>
      <SessionTable sessions={filtered} />
    </div>
  );
}
