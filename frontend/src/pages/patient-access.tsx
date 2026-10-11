import { Link } from "react-router";
import { ShieldCheck } from "lucide-react";
export default function PatientAccessHelp() {
  return <main className="max-w-xl mx-auto p-6 py-12 space-y-6"><Link className="underline" to="/">Teach-It-Back</Link><ShieldCheck className="size-10" /><h1 className="text-3xl font-semibold">Open your patient invitation</h1><p>Your study coordinator will give you a private review link and a separate access code. Open that link, then enter the code to begin or resume your review.</p><p>If your invitation expired or you cannot find it, ask your coordinator for a new invitation.</p><Link className="underline" to="/login">Coordinator sign in</Link></main>;
}
