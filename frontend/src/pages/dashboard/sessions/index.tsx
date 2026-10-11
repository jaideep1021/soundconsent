import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router';

export default function SessionsPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[48px] leading-[1] font-[600] text-[#1c1c1c] tracking-[-1.2px]">Sessions</h1>
          <p className="text-lg text-[#5f5f5d] mt-2">Monitor patient teach-back sessions.</p>
        </div>
        <Button 
          className="bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90 shadow-[rgba(255,255,255,0.2)_0px_0.5px_0px_0px_inset,rgba(0,0,0,0.2)_0px_0px_0px_0.5px_inset,rgba(0,0,0,0.05)_0px_1px_2px_0px]"
          onClick={() => navigate('/dashboard/sessions/new')}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Session
        </Button>
      </div>

      {/* Tools */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5f5d]" />
          <Input 
            placeholder="Search patients or sessions..." 
            className="pl-9 bg-[#f7f4ed] border-[#eceae4] focus-visible:ring-blue-500/50"
          />
        </div>
        <Button variant="outline" className="border-[#eceae4] bg-[#f7f4ed] text-[#1c1c1c] hover:bg-[#1c1c1c]/[0.04]">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>

      {/* Sessions Table */}
      <div className="border border-[#eceae4] rounded-xl overflow-hidden bg-[#f7f4ed]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#eceae4]">
              <th className="px-6 py-4 font-[600] text-[#1c1c1c]">Patient Name</th>
              <th className="px-6 py-4 font-[600] text-[#1c1c1c]">Document</th>
              <th className="px-6 py-4 font-[600] text-[#1c1c1c]">Status</th>
              <th className="px-6 py-4 font-[600] text-[#1c1c1c]">Progress</th>
              <th className="px-6 py-4 font-[600] text-[#1c1c1c]">Date</th>
              <th className="px-6 py-4 font-[600] text-[#1c1c1c] text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eceae4]">
            {[
              { id: '1', patient: 'Jane Doe', doc: 'Knee Replacement', status: 'Needs Review', progress: '100%', date: 'Today, 10:42 AM', badge: 'destructive' },
              { id: '2', patient: 'John Smith', doc: 'Cataract Surgery', status: 'Completed', progress: '100%', date: 'Yesterday, 2:15 PM', badge: 'secondary' },
              { id: '3', patient: 'Emily Chen', doc: 'Dental Implant', status: 'Active', progress: '60%', date: 'Today, 9:00 AM', badge: 'default' },
              { id: '4', patient: 'Michael Brown', doc: 'General Anesthesia', status: 'Pending', progress: '0%', date: 'Oct 09, 4:00 PM', badge: 'outline' },
            ].map((session) => (
              <tr key={session.id} className="hover:bg-[#1c1c1c]/[0.02] transition-colors cursor-pointer" onClick={() => navigate(`/dashboard/sessions/${session.id}${session.status === 'Needs Review' ? '/report' : ''}`)}>
                <td className="px-6 py-4 font-[400] text-[#1c1c1c]">{session.patient}</td>
                <td className="px-6 py-4 text-[#5f5f5d]">{session.doc}</td>
                <td className="px-6 py-4">
                  <Badge variant={session.badge as any} className="rounded-full px-2.5 py-0.5 font-[400]">
                    {session.status}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-[#5f5f5d]">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 rounded-full bg-[#eceae4] overflow-hidden">
                      <div className="h-full bg-[#1c1c1c]" style={{ width: session.progress }} />
                    </div>
                    <span>{session.progress}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-[#5f5f5d]">{session.date}</td>
                <td className="px-6 py-4 text-right">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-[#1c1c1c] hover:bg-[#1c1c1c]/[0.04]"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/dashboard/sessions/${session.id}${session.status === 'Needs Review' ? '/report' : ''}`);
                    }}
                  >
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
