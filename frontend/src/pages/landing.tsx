import { Link } from 'react-router';
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
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f7f4ed] text-[#1c1c1c] flex flex-col font-sans selection:bg-[#1c1c1c] selection:text-[#fcfbf8]">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-[#f7f4ed]/90 backdrop-blur-md border-b border-[#eceae4]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[#1c1c1c] flex items-center justify-center text-[#fcfbf8] shadow-[var(--shadow-inset-button)]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-lg tracking-tight text-[#1c1c1c]">
                SoundConsent
              </span>
              <span className="text-xs uppercase tracking-wider text-[#5f5f5d] font-medium hidden sm:inline-block">
                Teach-It-Back
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-3 sm:gap-6">
            <Link 
              to="/dashboard" 
              className="text-sm font-medium text-[#5f5f5d] hover:text-[#1c1c1c] transition-colors hidden md:inline-block"
            >
              Dashboard
            </Link>
            <Link 
              to="/dashboard/documents" 
              className="text-sm font-medium text-[#5f5f5d] hover:text-[#1c1c1c] transition-colors hidden md:inline-block"
            >
              Documents
            </Link>
            <Link 
              to="/dashboard/sessions" 
              className="text-sm font-medium text-[#5f5f5d] hover:text-[#1c1c1c] transition-colors hidden md:inline-block"
            >
              Sessions
            </Link>
            <Button asChild variant="outline" size="sm" className="border-[#eceae4] text-[#1c1c1c] bg-[#f7f4ed] hover:bg-[#eceae4]/50">
              <Link to="/login">Coordinator Sign In</Link>
            </Button>
            <Button asChild size="sm" className="bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90 shadow-[var(--shadow-inset-button)]">
              <Link to="/session/mock-session-1">
                Patient Demo
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="pt-16 pb-12 sm:pt-24 sm:pb-20 max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#eceae4] bg-[#f7f4ed] text-xs font-medium text-[#5f5f5d] mb-8">
            <Sparkles className="w-3.5 h-3.5 text-[#1c1c1c]" />
            <span>Autonomous Informed Consent Verification System</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-semibold tracking-[-1.5px] leading-[1.08] text-[#1c1c1c] mb-6 max-w-4xl mx-auto">
            Transforming Informed Consent into Verified Understanding
          </h1>

          <p className="text-lg sm:text-xl text-[#5f5f5d] max-w-2xl mx-auto leading-relaxed mb-10 font-normal">
            Replace passive signature-seeking with an interactive teach-back companion. 
            Engages patients through plain-language dialogue, verifies true comprehension, 
            and alerts clinical coordinators to potential gaps.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button 
              asChild 
              size="lg" 
              className="bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90 px-7 h-12 text-base rounded-md shadow-[var(--shadow-inset-button)]"
            >
              <Link to="/session/mock-session-1" className="flex items-center gap-2">
                Launch Patient Companion <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button 
              asChild 
              variant="outline" 
              size="lg" 
              className="border-[rgba(28,28,28,0.4)] text-[#1c1c1c] bg-transparent hover:bg-[rgba(28,28,28,0.04)] px-7 h-12 text-base rounded-md"
            >
              <Link to="/dashboard">
                Open Clinical Dashboard
              </Link>
            </Button>
          </div>
        </section>

        {/* Dual Portal Gateway Grid */}
        <section className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Door 1: Patient Experience */}
            <Card className="bg-[#f7f4ed] border-[#eceae4] rounded-2xl p-2 transition-all hover:border-[rgba(28,28,28,0.4)] flex flex-col justify-between">
              <div>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#5f5f5d] px-2.5 py-1 rounded-full bg-[#eceae4]/70">
                      Patient Portal
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-[#5f5f5d]">
                      <span className="w-2 h-2 rounded-full bg-[#22c55e]"></span>
                      Active Demo
                    </span>
                  </div>
                  <CardTitle className="text-2xl font-semibold text-[#1c1c1c] tracking-tight">
                    Teach-It-Back Patient Session
                  </CardTitle>
                  <CardDescription className="text-base text-[#5f5f5d] leading-normal pt-1">
                    Patients review their procedure consent via guided conversation. The AI tests their understanding in plain language before capturing legal sign-off.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-2">
                  <div className="p-3.5 rounded-lg border border-[#eceae4] bg-[#eceae4]/30 space-y-1 text-xs">
                    <div className="font-semibold text-[#1c1c1c] flex items-center justify-between">
                      <span>Mock Patient Credentials</span>
                      <span className="text-[10px] text-[#5f5f5d]">Pre-loaded for instant access</span>
                    </div>
                    <div className="text-[#5f5f5d] flex flex-wrap gap-x-4 gap-y-1">
                      <span><strong>Name:</strong> Jane Doe</span>
                      <span><strong>DOB:</strong> 1980-05-15</span>
                      <span><strong>Procedure:</strong> Lumbar Puncture</span>
                    </div>
                  </div>

                  <ul className="space-y-2.5 text-sm text-[#1c1c1c]">
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#1c1c1c] shrink-0 mt-0.5" />
                      <span>Compliant AI disclosure (strictly introduced as AI, not a doctor)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <MessageSquare className="w-4 h-4 text-[#1c1c1c] shrink-0 mt-0.5" />
                      <span>Interactive chat companion with dynamic teach-back questions</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Headphones className="w-4 h-4 text-[#1c1c1c] shrink-0 mt-0.5" />
                      <span>Live voice companion interface with real-time audio status</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-[#1c1c1c] shrink-0 mt-0.5" />
                      <span>Digital signature canvas and understanding audit trail</span>
                    </li>
                  </ul>
                </CardContent>
              </div>

              <div className="p-6 pt-4 border-t border-[#eceae4] mt-4 space-y-3">
                <Button asChild className="w-full bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90 rounded-md h-11 text-sm shadow-[var(--shadow-inset-button)]">
                  <Link to="/session/mock-session-1" className="flex items-center justify-center gap-2">
                    Enter as Patient (Session ID: mock-session-1) <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
                <div className="flex items-center justify-center gap-4 text-xs text-[#5f5f5d]">
                  <Link to="/session/mock-session-1/chat" className="underline hover:text-[#1c1c1c]">Direct to Chat</Link>
                  <span>•</span>
                  <Link to="/session/mock-session-1/voice" className="underline hover:text-[#1c1c1c]">Direct to Voice</Link>
                  <span>•</span>
                  <Link to="/session/mock-session-1/summary" className="underline hover:text-[#1c1c1c]">Direct to Summary</Link>
                </div>
              </div>
            </Card>

            {/* Door 2: Clinical Coordinator */}
            <Card className="bg-[#f7f4ed] border-[#eceae4] rounded-2xl p-2 transition-all hover:border-[rgba(28,28,28,0.4)] flex flex-col justify-between">
              <div>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#5f5f5d] px-2.5 py-1 rounded-full bg-[#eceae4]/70">
                      Coordinator Portal
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-[#5f5f5d]">
                      <Activity className="w-3.5 h-3.5 text-[#1c1c1c]" />
                      Clinical Suite
                    </span>
                  </div>
                  <CardTitle className="text-2xl font-semibold text-[#1c1c1c] tracking-tight">
                    Clinical Coordinator Dashboard
                  </CardTitle>
                  <CardDescription className="text-base text-[#5f5f5d] leading-normal pt-1">
                    Upload and manage Informed Consent Forms (ICFs), monitor patient sessions, and review actionable Understanding Reports.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-2">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 rounded-lg border border-[#eceae4] bg-[#eceae4]/20">
                      <div className="text-lg font-semibold text-[#1c1c1c]">89%</div>
                      <div className="text-[11px] text-[#5f5f5d]">Avg. Comprehension</div>
                    </div>
                    <div className="p-3 rounded-lg border border-[#eceae4] bg-[#eceae4]/20">
                      <div className="text-lg font-semibold text-[#1c1c1c]">12</div>
                      <div className="text-[11px] text-[#5f5f5d]">Completed ICFs</div>
                    </div>
                    <div className="p-3 rounded-lg border border-[#eceae4] bg-[#eceae4]/20">
                      <div className="text-lg font-semibold text-[#ef4444]">2</div>
                      <div className="text-[11px] text-[#5f5f5d]">Nurse Escalations</div>
                    </div>
                  </div>

                  <ul className="space-y-2.5 text-sm text-[#1c1c1c]">
                    <li className="flex items-start gap-2.5">
                      <FileText className="w-4 h-4 text-[#1c1c1c] shrink-0 mt-0.5" />
                      <span>ICF PDF upload with readability scoring & section analysis</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-[#1c1c1c] shrink-0 mt-0.5" />
                      <span>Highlighting failed teach-backs & out-of-scope patient queries</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Users className="w-4 h-4 text-[#1c1c1c] shrink-0 mt-0.5" />
                      <span>Real-time patient progress tracking (pending, active, completed)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Lock className="w-4 h-4 text-[#1c1c1c] shrink-0 mt-0.5" />
                      <span>Audit-trail compliance export for clinical trials and hospital IRBs</span>
                    </li>
                  </ul>
                </CardContent>
              </div>

              <div className="p-6 pt-4 border-t border-[#eceae4] mt-4 space-y-3">
                <Button asChild className="w-full bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90 rounded-md h-11 text-sm shadow-[var(--shadow-inset-button)]">
                  <Link to="/dashboard" className="flex items-center justify-center gap-2">
                    Enter Clinical Dashboard <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
                <div className="flex items-center justify-center gap-4 text-xs text-[#5f5f5d]">
                  <Link to="/dashboard/documents" className="underline hover:text-[#1c1c1c]">Document Library</Link>
                  <span>•</span>
                  <Link to="/dashboard/sessions" className="underline hover:text-[#1c1c1c]">Active Sessions</Link>
                  <span>•</span>
                  <Link to="/dashboard/sessions/mock-session-1/report" className="underline hover:text-[#1c1c1c]">Understanding Report</Link>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Feature Highlights Banner */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="border-t border-[#eceae4] pt-12">
            <h2 className="text-xs uppercase tracking-wider text-[#5f5f5d] font-semibold mb-8 text-center">
              Core Design & Clinical Compliance Pillars
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-[#1c1c1c] tracking-tight">
                  Reduced Cognitive Load
                </h3>
                <p className="text-sm text-[#5f5f5d] leading-relaxed">
                  Crafted with a warm parchment palette and humanist typography to reduce anxiety and assist patients of varying health literacy.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-semibold text-[#1c1c1c] tracking-tight">
                  Conversational Verification
                </h3>
                <p className="text-sm text-[#5f5f5d] leading-relaxed">
                  Patients explain back core concepts in their own words. AI evaluates comprehension against protocol-specific criteria before proceeding.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-semibold text-[#1c1c1c] tracking-tight">
                  Targeted Clinician Escalation
                </h3>
                <p className="text-sm text-[#5f5f5d] leading-relaxed">
                  Understanding Reports immediately flag specific misconceptions, allowing human coordinators to focus bedside discussions where it matters most.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-[#eceae4] bg-[#f7f4ed] py-8 text-xs text-[#5f5f5d]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#1c1c1c]" />
            <span className="font-medium text-[#1c1c1c]">SoundConsent · Teach-It-Back Companion</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="hover:text-[#1c1c1c] transition-colors">Coordinator Login</Link>
            <Link to="/dashboard" className="hover:text-[#1c1c1c] transition-colors">Dashboard</Link>
            <Link to="/session/mock-session-1" className="hover:text-[#1c1c1c] transition-colors">Patient Portal</Link>
            <span>v1.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
