import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Upload, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router';

import { DocumentUploadModal } from '@/components/dashboard/document-upload';

export default function DashboardHome() {
  const navigate = useNavigate();

  return (
    <div className="space-y-12">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[48px] leading-[1] font-[600] text-[#1c1c1c] tracking-[-1.2px]">Overview</h1>
          <p className="text-lg text-[#5f5f5d] mt-2">Welcome to your Teach-It-Back dashboard.</p>
        </div>
        <div className="flex items-center gap-3">
          <DocumentUploadModal>
            <Button 
              variant="outline"
              className="border-[#1c1c1c]/[0.4] bg-transparent text-[#1c1c1c] hover:bg-[#1c1c1c]/[0.04]"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          </DocumentUploadModal>
          <Button 
            className="bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90 shadow-[rgba(255,255,255,0.2)_0px_0.5px_0px_0px_inset,rgba(0,0,0,0.2)_0px_0px_0px_0.5px_inset,rgba(0,0,0,0.05)_0px_1px_2px_0px]"
            onClick={() => navigate('/dashboard/sessions/new')}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Session
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Active Sessions', value: '4' },
          { label: 'Pending Reviews', value: '12' },
          { label: 'Documents Uploaded', value: '8' },
        ].map((stat, i) => (
          <Card key={i} className="bg-[#f7f4ed] border-[#eceae4] shadow-none">
            <CardContent className="p-6">
              <div className="text-[48px] leading-[1] font-[600] text-[#1c1c1c] tracking-[-1.2px]">
                {stat.value}
              </div>
              <div className="text-base text-[#5f5f5d] mt-2 font-[400]">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Sessions */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[36px] leading-[1.1] font-[600] text-[#1c1c1c] tracking-[-0.9px]">Recent Sessions</h2>
          <Button variant="link" className="text-[#1c1c1c] p-0 h-auto font-[400]" onClick={() => navigate('/dashboard/sessions')}>
            View all <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        <div className="border border-[#eceae4] rounded-xl overflow-hidden bg-[#f7f4ed]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#eceae4]">
                <th className="px-6 py-4 font-[600] text-[#1c1c1c]">Patient Name</th>
                <th className="px-6 py-4 font-[600] text-[#1c1c1c]">Document</th>
                <th className="px-6 py-4 font-[600] text-[#1c1c1c]">Status</th>
                <th className="px-6 py-4 font-[600] text-[#1c1c1c]">Date</th>
                <th className="px-6 py-4 font-[600] text-[#1c1c1c] text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eceae4]">
              {[
                { id: '1', patient: 'Jane Doe', doc: 'Knee Replacement ICF', status: 'Needs Review', date: 'Today, 10:42 AM', badge: 'destructive' },
                { id: '2', patient: 'John Smith', doc: 'Cataract Surgery ICF', status: 'Completed', date: 'Yesterday, 2:15 PM', badge: 'secondary' },
                { id: '3', patient: 'Emily Chen', doc: 'Dental Implant ICF', status: 'Active', date: 'Yesterday, 9:00 AM', badge: 'default' },
              ].map((session) => (
                <tr key={session.id} className="hover:bg-[#1c1c1c]/[0.02] transition-colors">
                  <td className="px-6 py-4 font-[400] text-[#1c1c1c]">{session.patient}</td>
                  <td className="px-6 py-4 text-[#5f5f5d]">{session.doc}</td>
                  <td className="px-6 py-4">
                    <Badge variant={session.badge as any} className="rounded-full px-2.5 py-0.5 font-[400]">
                      {session.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-[#5f5f5d]">{session.date}</td>
                  <td className="px-6 py-4 text-right">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-[#1c1c1c] hover:bg-[#1c1c1c]/[0.04]"
                      onClick={() => navigate(`/dashboard/sessions/${session.id}${session.status === 'Needs Review' ? '/report' : ''}`)}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
