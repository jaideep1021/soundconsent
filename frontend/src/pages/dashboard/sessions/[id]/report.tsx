import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, AlertTriangle, CheckCircle2, Bell, HelpCircle, Printer } from 'lucide-react';
import { useNavigate } from 'react-router';

export default function UnderstandingReportPage() {
  const navigate = useNavigate();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-12 max-w-4xl print:p-0 print:max-w-none">
      {/* Top Header */}
      <div className="space-y-6 print:hidden">
        <Button 
          variant="ghost" 
          className="text-[#5f5f5d] hover:text-[#1c1c1c] hover:bg-[#1c1c1c]/[0.04] p-0 h-auto"
          onClick={() => navigate('/dashboard/sessions')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sessions
        </Button>
        
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="destructive" className="rounded-full px-2.5 py-0.5 font-[400]">
                Needs Nurse Follow-Up
              </Badge>
              <span className="text-sm text-[#5f5f5d]">Completed today at 11:05 AM</span>
            </div>
            <h1 className="text-[48px] leading-[1] font-[600] text-[#1c1c1c] tracking-[-1.2px]">Understanding Report</h1>
            <p className="text-lg text-[#5f5f5d] mt-2">
              Patient: <span className="text-[#1c1c1c] font-[600]">Jane Doe</span> • ICF: Total Knee Arthroplasty
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              className="border-[#eceae4] bg-[#f7f4ed] text-[#1c1c1c] hover:bg-[#1c1c1c]/[0.04]"
              onClick={handlePrint}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button 
              className="bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90 shadow-[rgba(255,255,255,0.2)_0px_0.5px_0px_0px_inset,rgba(0,0,0,0.2)_0px_0px_0px_0.5px_inset,rgba(0,0,0,0.05)_0px_1px_2px_0px]"
            >
              <Bell className="w-4 h-4 mr-2" />
              Flag for Nurse
            </Button>
          </div>
        </div>
      </div>

      {/* Print-only title */}
      <div className="hidden print:block mb-8">
        <h1 className="text-3xl font-[600] text-[#1c1c1c]">Teach-It-Back Understanding Report</h1>
        <p className="text-sm text-[#5f5f5d] mt-1">Patient: Jane Doe | Form: Total Knee Arthroplasty | Date: Oct 10, 2026</p>
      </div>

      {/* Executive Summary / Overall Score */}
      <Card className="bg-[#f7f4ed] border-[#eceae4] shadow-none">
        <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-[20px] font-[600] text-[#1c1c1c]">Overall Assessment</h2>
            <p className="text-[#5f5f5d] max-w-lg leading-relaxed">
              Patient demonstrated satisfactory comprehension on surgical purpose and alternatives, but missed critical awareness regarding post-operative blood clot prevention and long-term recovery timeline.
            </p>
          </div>
          <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-[#eceae4] pt-4 md:pt-0 md:pl-8">
            <div className="text-center">
              <div className="text-[48px] font-[600] text-[#1c1c1c] leading-none">67%</div>
              <div className="text-xs text-[#5f5f5d] mt-1 uppercase tracking-wider">Score</div>
            </div>
            <div className="text-center">
              <div className="text-[48px] font-[600] text-red-600 leading-none">1</div>
              <div className="text-xs text-[#5f5f5d] mt-1 uppercase tracking-wider">Flagged</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* High-Priority / Failed Sections */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h2 className="text-[20px] font-[600] text-[#1c1c1c]">Needs Follow-Up (Priority)</h2>
        </div>
        
        <div className="border border-red-200 bg-red-50/20 rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <Badge variant="destructive" className="rounded-full px-2.5 py-0.5 font-[400] mb-2">
                Section 2: Partial Understanding
              </Badge>
              <h3 className="text-[18px] font-[600] text-[#1c1c1c]">Risks and Side Effects</h3>
            </div>
          </div>

          <div className="space-y-3 bg-[#f7f4ed] border border-[#eceae4] rounded-lg p-4">
            <div>
              <span className="text-xs font-[600] text-[#5f5f5d] uppercase tracking-wider">Patient's Teach-Back Response:</span>
              <p className="text-sm text-[#1c1c1c] italic mt-1">
                "The doctor will replace the joint with metal. I might feel dizzy from the drugs, and there will be pain for a few weeks."
              </p>
            </div>
            <div className="border-t border-[#eceae4] pt-3">
              <span className="text-xs font-[600] text-red-600 uppercase tracking-wider">AI Clinical Assessment:</span>
              <p className="text-sm text-[#1c1c1c] mt-1">
                Missed mention of infection risks, deep vein thrombosis (blood clots), and the necessity of prescribed blood thinners. Re-education recommended.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button size="sm" className="bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90">
              Acknowledge & Clear Flag
            </Button>
            <Button size="sm" variant="ghost" className="text-[#5f5f5d] hover:text-[#1c1c1c]">
              Review Transcript Snippet
            </Button>
          </div>
        </div>
      </section>

      {/* Out-of-Scope Questions Flagged */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-amber-600" />
          <h2 className="text-[20px] font-[600] text-[#1c1c1c]">Unresolved Patient Inquiries</h2>
        </div>
        
        <Card className="bg-[#f7f4ed] border-[#eceae4] shadow-none">
          <CardContent className="p-6">
            <p className="text-sm text-[#5f5f5d] mb-4">
              The AI was strictly bound to the ICF scope and politely flagged the following out-of-scope medical questions for the clinical care team:
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-2 shrink-0" />
                <div>
                  <span className="font-[600] text-[#1c1c1c]">"Can I keep taking my herbal supplements before surgery?"</span>
                  <p className="text-xs text-[#5f5f5d] mt-0.5">Asked during Section 1 review • Marked for Pre-Op Nurse</p>
                </div>
              </li>
              <li className="flex items-start gap-3 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-2 shrink-0" />
                <div>
                  <span className="font-[600] text-[#1c1c1c]">"Will Dr. Smith be doing the entire surgery himself or a resident?"</span>
                  <p className="text-xs text-[#5f5f5d] mt-0.5">Asked during Section 3 review • Marked for Surgical Team</p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Passed Sections Breakdown */}
      <section className="space-y-4">
        <h2 className="text-[20px] font-[600] text-[#1c1c1c]">Passed Sections</h2>
        <div className="space-y-4">
          {[
            {
              title: 'Section 1: Purpose of Procedure',
              response: '"I understand that my knee cartilage is worn out, and the surgery replaces it to help relieve pain."',
              assessment: 'Demonstrated complete understanding of surgical indication.',
            },
            {
              title: 'Section 3: Alternatives & Voluntary Consent',
              response: '"I could do steroid injections or physical therapy instead, and I don\'t have to do the surgery if I don\'t want to."',
              assessment: 'Full comprehension of voluntariness and alternatives.',
            },
          ].map((sec, idx) => (
            <div key={idx} className="border border-[#eceae4] rounded-xl bg-[#f7f4ed] p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[18px] font-[600] text-[#1c1c1c]">{sec.title}</h3>
                <Badge variant="default" className="rounded-full px-2.5 py-0.5 font-[400] bg-green-100 text-green-800 hover:bg-green-100">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Passed
                </Badge>
              </div>
              <div className="bg-[#1c1c1c]/[0.02] border border-[#eceae4] rounded-lg p-3 text-sm">
                <span className="text-xs text-[#5f5f5d] block">Response:</span>
                <span className="italic text-[#1c1c1c]">{sec.response}</span>
              </div>
              <p className="text-xs text-[#5f5f5d]">{sec.assessment}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
