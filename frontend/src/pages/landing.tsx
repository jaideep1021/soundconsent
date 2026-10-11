import { Link } from "react-router";
import {
  ShieldCheck,
  ArrowRight,
  MessageSquare,
  Headphones,
  FileText,
  Activity,
  CheckCircle2,
  Sparkles,
  Lock,
  Users,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream text-charcoal flex flex-col font-sans selection:bg-charcoal selection:text-off-white">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-cream/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-charcoal flex items-center justify-center text-off-white shadow-[var(--shadow-inset-button)]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-lg tracking-tight text-charcoal">
                SoundConsent
              </span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium hidden sm:inline-block">
                Teach-It-Back
              </span>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-3 sm:gap-6">
            <Link
              to="/dashboard"
              className="text-sm font-medium text-muted-foreground hover:text-charcoal transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/dashboard/documents"
              className="text-sm font-medium text-muted-foreground hover:text-charcoal transition-colors"
            >
              Documents
            </Link>
            <Link
              to="/dashboard/sessions"
              className="text-sm font-medium text-muted-foreground hover:text-charcoal transition-colors"
            >
              Sessions
            </Link>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-border text-charcoal bg-cream hover:bg-border/50"
            >
              <Link to="/login">Coordinator Sign In</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-charcoal text-off-white hover:bg-charcoal/90 shadow-[var(--shadow-inset-button)]"
            >
              <Link to="/patient">Patient Access</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="pt-16 pb-12 sm:pt-24 sm:pb-20 max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-cream text-xs font-medium text-muted-foreground mb-8">
            <Sparkles className="w-3.5 h-3.5 text-charcoal" />
            <span>Guided consent understanding reviews</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-semibold tracking-[-1.5px] leading-[1.08] text-charcoal mb-6 max-w-4xl mx-auto">
            Understanding Consent, One Conversation at a Time
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10 font-normal">
            Review consent documents through plain-language dialogue and teach-back.
            Keep questions and understanding gaps ready for discussion with your clinical team.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="bg-charcoal text-off-white hover:bg-charcoal/90 px-7 h-12 text-base rounded-md shadow-[var(--shadow-inset-button)]"
            >
              <Link
                to="/patient"
                className="flex items-center gap-2"
              >
                Patient invitation help <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-border-interactive text-charcoal bg-transparent hover:bg-[rgba(28,28,28,0.04)] px-7 h-12 text-base rounded-md"
            >
              <Link to="/dashboard">Open Clinical Dashboard</Link>
            </Button>
          </div>
        </section>

        {/* Dual Portal Gateway Grid */}
        <section className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Door 1: Patient Experience */}
            <Card className="bg-cream border-border rounded-2xl p-2 transition-all hover:border-border-interactive flex flex-col justify-between">
              <div>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2.5 py-1 rounded-full bg-border/70">
                      Patient Portal
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="w-2 h-2 rounded-full bg-[#22c55e]"></span>
                      Invitation access
                    </span>
                  </div>
                  <CardTitle className="text-2xl font-semibold text-charcoal tracking-tight">
                    Teach-It-Back Patient Session
                  </CardTitle>
                  <CardDescription className="text-base text-muted-foreground leading-normal pt-1">
                    Patients review their procedure consent via guided
                    conversation. The AI tests their understanding in plain
                    language before a final discussion with their clinical team.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-2">
                  <div className="p-3.5 rounded-lg border border-border bg-border/30 text-sm text-muted-foreground">
                    Your coordinator provides a private invitation link and a separate access code. Open that link to start or resume your review.
                  </div>

                  <ul className="space-y-2.5 text-sm text-charcoal">
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-charcoal shrink-0 mt-0.5" />
                      <span>
                        Clear AI disclosure and referral to the clinical team
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <MessageSquare className="w-4 h-4 text-charcoal shrink-0 mt-0.5" />
                      <span>
                        Interactive chat companion with dynamic teach-back
                        questions
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Headphones className="w-4 h-4 text-charcoal shrink-0 mt-0.5" />
                      <span>
                        Live voice companion interface with real-time audio
                        status
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-charcoal shrink-0 mt-0.5" />
                      <span>
                        Saved review acknowledgment and understanding history
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </div>

              <div className="p-6 pt-4 border-t border-border mt-4 space-y-3">
                <Button
                  asChild
                  className="w-full bg-charcoal text-off-white hover:bg-charcoal/90 rounded-md h-11 text-sm shadow-[var(--shadow-inset-button)]"
                >
                  <Link
                    to="/patient"
                    className="flex items-center justify-center gap-2"
                  >
                    How to open your invitation{" "}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
                <p className="text-sm text-muted-foreground text-center">Text, voice and your summary are available within your authorized review.</p>
              </div>
            </Card>

            {/* Door 2: Clinical Coordinator */}
            <Card className="bg-cream border-border rounded-2xl p-2 transition-all hover:border-border-interactive flex flex-col justify-between">
              <div>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2.5 py-1 rounded-full bg-border/70">
                      Coordinator Portal
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Activity className="w-3.5 h-3.5 text-charcoal" />
                      Clinical Suite
                    </span>
                  </div>
                  <CardTitle className="text-2xl font-semibold text-charcoal tracking-tight">
                    Clinical Coordinator Dashboard
                  </CardTitle>
                  <CardDescription className="text-base text-muted-foreground leading-normal pt-1">
                    Upload and manage Informed Consent Forms (ICFs), monitor
                    patient sessions, and review actionable Understanding
                    Reports.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-2">
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    {["Documents", "Reviews", "Follow-ups"].map((label) => <div key={label} className="p-3 rounded-lg border border-border bg-border/20">{label}</div>)}
                  </div>

                  <ul className="space-y-2.5 text-sm text-charcoal">
                    <li className="flex items-start gap-2.5">
                      <FileText className="w-4 h-4 text-charcoal shrink-0 mt-0.5" />
                      <span>
                        ICF PDF upload, section extraction and version management
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-charcoal shrink-0 mt-0.5" />
                      <span>
                        Highlighting failed teach-backs & out-of-scope patient
                        queries
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Users className="w-4 h-4 text-charcoal shrink-0 mt-0.5" />
                      <span>
                        Real-time patient progress tracking (pending, active,
                        completed)
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Lock className="w-4 h-4 text-charcoal shrink-0 mt-0.5" />
                      <span>
                        Downloadable understanding reports and follow-up history
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </div>

              <div className="p-6 pt-4 border-t border-border mt-4 space-y-3">
                <Button
                  asChild
                  className="w-full bg-charcoal text-off-white hover:bg-charcoal/90 rounded-md h-11 text-sm shadow-[var(--shadow-inset-button)]"
                >
                  <Link
                    to="/dashboard"
                    className="flex items-center justify-center gap-2"
                  >
                    Enter Clinical Dashboard <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <Link
                    to="/dashboard/documents"
                    className="underline hover:text-charcoal"
                  >
                    Document Library
                  </Link>
                  <span>•</span>
                  <Link
                    to="/dashboard/sessions"
                    className="underline hover:text-charcoal"
                  >
                    Active Sessions
                  </Link>
                  <span>•</span>
                  <Link
                    to="/dashboard/sessions"
                    className="underline hover:text-charcoal"
                  >
                    Understanding Report
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Feature Highlights Banner */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="border-t border-border pt-12">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-8 text-center">
              Designed for Clearer Conversations
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-charcoal tracking-tight">
                  Reduced Cognitive Load
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Crafted with a warm parchment palette and humanist typography
                  to reduce anxiety and assist patients of varying health
                  literacy.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-semibold text-charcoal tracking-tight">
                  Conversational Verification
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Patients explain back core concepts in their own words. AI
                  evaluates comprehension against protocol-specific criteria
                  before proceeding.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-semibold text-charcoal tracking-tight">
                  Targeted Clinician Escalation
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Understanding Reports immediately flag specific
                  misconceptions, allowing human coordinators to focus bedside
                  discussions where it matters most.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-border bg-cream py-8 text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-charcoal" />
            <span className="font-medium text-charcoal">
              SoundConsent · Teach-It-Back Companion
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="hover:text-charcoal transition-colors">
              Coordinator Login
            </Link>
            <Link
              to="/dashboard"
              className="hover:text-charcoal transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/patient"
              className="hover:text-charcoal transition-colors"
            >
              Patient Portal
            </Link>
            <span>v1.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
