import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Clock, FileText } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';

export default function SessionDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <div className="space-y-12 max-w-4xl">
      {/* Header */}
      <div className="space-y-6">
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
              <Badge variant="default" className="rounded-full px-2.5 py-0.5 font-[400]">
                Active Now
              </Badge>
              <span className="text-sm text-[#5f5f5d]">Started 14 minutes ago</span>
            </div>
            <h1 className="text-[48px] leading-[1] font-[600] text-[#1c1c1c] tracking-[-1.2px]">Jane Doe</h1>
            <p className="text-lg text-[#5f5f5d] mt-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Document: Total Knee Arthroplasty
            </p>
          </div>
          <Button 
            className="bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90 shadow-[rgba(255,255,255,0.2)_0px_0.5px_0px_0px_inset,rgba(0,0,0,0.2)_0px_0px_0px_0.5px_inset,rgba(0,0,0,0.05)_0px_1px_2px_0px]"
            onClick={() => navigate(`/dashboard/sessions/${id}/report`)}
          >
            View Live Report
          </Button>
        </div>
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#f7f4ed] border-[#eceae4] shadow-none">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#5f5f5d] font-[400]">Mode</span>
              <Badge variant="outline" className="border-[#eceae4]">Voice Mode</Badge>
            </div>
            <div className="text-[20px] font-[600] text-[#1c1c1c] mt-2">ElevenLabs Live</div>
          </CardContent>
        </Card>
        <Card className="bg-[#f7f4ed] border-[#eceae4] shadow-none">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#5f5f5d] font-[400]">Current Progress</span>
              <span className="text-sm font-[600] text-[#1c1c1c]">2 of 5</span>
            </div>
            <div className="text-[20px] font-[600] text-[#1c1c1c] mt-2">Section 2: Risks</div>
          </CardContent>
        </Card>
        <Card className="bg-[#f7f4ed] border-[#eceae4] shadow-none">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#5f5f5d] font-[400]">Elapsed Time</span>
              <Clock className="w-4 h-4 text-[#5f5f5d]" />
            </div>
            <div className="text-[20px] font-[600] text-[#1c1c1c] mt-2">14m 22s</div>
          </CardContent>
        </Card>
      </div>

      {/* Live Timeline */}
      <div className="space-y-6">
        <h2 className="text-[20px] leading-[1.25] font-[400] text-[#1c1c1c]">Teach-Back Progress</h2>
        <div className="space-y-4">
          {[
            { title: '1. Procedure Overview', status: 'Completed', result: 'Passed', detail: 'Patient correctly identified this is a knee replacement surgery.' },
            { title: '2. Risks and Side Effects', status: 'In Progress', result: 'Evaluating', detail: 'Currently discussing potential blood clot risks...' },
            { title: '3. Alternatives to Surgery', status: 'Upcoming', result: 'Pending', detail: 'Physical therapy and conservative management options.' },
          ].map((item, index) => (
            <div key={index} className="border border-[#eceae4] rounded-xl bg-[#f7f4ed] p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[18px] font-[600] text-[#1c1c1c]">{item.title}</h3>
                <Badge variant={item.result === 'Passed' ? 'default' : item.result === 'Evaluating' ? 'destructive' : 'secondary'} className="rounded-full">
                  {item.result}
                </Badge>
              </div>
              <p className="text-sm text-[#5f5f5d]">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
