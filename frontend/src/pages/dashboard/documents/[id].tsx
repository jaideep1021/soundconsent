import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, FileText, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router';

export default function DocumentDetail() {
  const navigate = useNavigate();

  // Mock data for the sections
  const sections = [
    { id: 1, title: 'Introduction', content: 'This form asks for your consent to have a total knee replacement surgery.' },
    { id: 2, title: 'Risks and Side Effects', content: 'Possible risks include infection, blood clots, and joint stiffness.' },
    { id: 3, title: 'Alternatives', content: 'Alternatives include physical therapy, medication, or no treatment.' },
  ];

  return (
    <div className="space-y-12 max-w-4xl">
      {/* Header */}
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          className="text-[#5f5f5d] hover:text-[#1c1c1c] hover:bg-[#1c1c1c]/[0.04] p-0 h-auto"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Documents
        </Button>
        
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="default" className="rounded-full px-2.5 py-0.5 font-[400] bg-green-100 text-green-800 hover:bg-green-100">
                <CheckCircle2 className="w-3 h-3 mr-1" /> AI Parsed
              </Badge>
              <span className="text-sm text-[#5f5f5d]">Last edited today at 10:45 AM</span>
            </div>
            <h1 className="text-[48px] leading-[1] font-[600] text-[#1c1c1c] tracking-[-1.2px]">Total Knee Arthroplasty</h1>
            <p className="text-lg text-[#5f5f5d] mt-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Source: knee-replacement-v2.pdf
            </p>
          </div>
          <Button 
            className="bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90 shadow-[rgba(255,255,255,0.2)_0px_0.5px_0px_0px_inset,rgba(0,0,0,0.2)_0px_0px_0px_0.5px_inset,rgba(0,0,0,0.05)_0px_1px_2px_0px]"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Sections List */}
      <div className="space-y-6">
        <h2 className="text-[20px] leading-[1.25] font-[400] text-[#1c1c1c]">Extracted Sections</h2>
        <div className="space-y-4">
          {sections.map((section, index) => (
            <div key={section.id} className="border border-[#eceae4] rounded-xl bg-[#f7f4ed] p-6 hover:border-[#1c1c1c]/[0.4] transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#1c1c1c]/[0.04] text-sm font-[600] text-[#1c1c1c]">
                    {index + 1}
                  </span>
                  <h3 className="text-[18px] leading-[1.38] font-[600] text-[#1c1c1c]">{section.title}</h3>
                </div>
                <Button variant="ghost" size="sm" className="text-[#5f5f5d] hover:text-[#1c1c1c] hover:bg-[#1c1c1c]/[0.04]">
                  Edit
                </Button>
              </div>
              <p className="text-[#1c1c1c]/[0.82] text-[16px] leading-[1.5]">{section.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
