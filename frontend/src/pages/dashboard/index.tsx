import { Link } from "react-router";
import { useSessionStore } from "@/stores/session-store";
import { useDocumentStore } from "@/stores/document-store";
import { SessionTable } from "@/components/dashboard/session-table";
import { DocumentUploadModal } from "@/components/dashboard/document-upload";
import { Button } from "@/components/ui/button";
export default function DashboardHome() {
  const sessions = useSessionStore((s) => s.records);
  const documents = useDocumentStore((s) => s.documents);
  return (
    <div className="space-y-12">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold">Overview</h1>
          <p className="text-muted-foreground mt-2">
            Welcome to your Teach-It-Back dashboard.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <DocumentUploadModal>
            <Button variant="outline">Upload Document</Button>
          </DocumentUploadModal>
          <Button asChild>
            <Link to="/dashboard/sessions/new">New Session</Link>
          </Button>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {[
          [
            "Active Sessions",
            sessions.filter((s) => s.status === "in-progress").length,
          ],
          ["Pending Reviews", sessions.filter((s) => s.flagged).length],
          ["Documents", documents.length],
        ].map(([label, value]) => (
          <div key={label} className="border rounded-xl p-6">
            <div className="text-5xl font-semibold tracking-tight">{value}</div>
            <p className="mt-2 text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-semibold">Recent Sessions</h2>
          <Link className="underline" to="/dashboard/sessions">
            View all
          </Link>
        </div>
        <SessionTable sessions={sessions.slice(0, 5)} />
      </section>
    </div>
  );
}
