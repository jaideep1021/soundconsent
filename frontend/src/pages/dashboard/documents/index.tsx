import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, Search, MoreVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router';
import { DocumentUploadModal } from '@/components/dashboard/document-upload';

export default function DocumentsPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[48px] leading-[1] font-[600] text-[#1c1c1c] tracking-[-1.2px]">Documents</h1>
          <p className="text-lg text-[#5f5f5d] mt-2">Manage your Informed Consent Forms (ICF).</p>
        </div>
        <DocumentUploadModal>
          <Button 
            className="bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90 shadow-[rgba(255,255,255,0.2)_0px_0.5px_0px_0px_inset,rgba(0,0,0,0.2)_0px_0px_0px_0.5px_inset,rgba(0,0,0,0.05)_0px_1px_2px_0px]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Upload Document
          </Button>
        </DocumentUploadModal>
      </div>

      {/* Tools */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5f5d]" />
          <Input 
            placeholder="Search documents..." 
            className="pl-9 bg-[#f7f4ed] border-[#eceae4] focus-visible:ring-blue-500/50"
          />
        </div>
      </div>

      {/* Document Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { id: '1', title: 'Total Knee Arthroplasty', sections: 8, date: 'Oct 12, 2023', status: 'Active' },
          { id: '2', title: 'Cataract Surgery', sections: 5, date: 'Sep 28, 2023', status: 'Active' },
          { id: '3', title: 'General Anesthesia Consent', sections: 12, date: 'Aug 15, 2023', status: 'Draft' },
          { id: '4', title: 'Dental Implant Procedure', sections: 6, date: 'Jul 04, 2023', status: 'Archived' },
        ].map((doc) => (
          <Card key={doc.id} className="bg-[#f7f4ed] border-[#eceae4] shadow-none hover:border-[#1c1c1c]/[0.4] transition-colors cursor-pointer group" onClick={() => navigate(`/dashboard/documents/${doc.id}`)}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-full bg-[#1c1c1c]/[0.04] flex items-center justify-center group-hover:bg-[#1c1c1c]/[0.08] transition-colors">
                  <FileText className="w-6 h-6 text-[#1c1c1c]" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md text-[#5f5f5d] hover:text-[#1c1c1c] hover:bg-[#1c1c1c]/[0.04] transition-colors" onClick={(e) => e.stopPropagation()}>
                    <MoreVertical className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-[#f7f4ed] border-[#eceae4]">
                    <DropdownMenuItem className="text-[#1c1c1c] focus:bg-[#1c1c1c]/[0.04]">Edit Document</DropdownMenuItem>
                    <DropdownMenuItem className="text-[#1c1c1c] focus:bg-[#1c1c1c]/[0.04]">Duplicate</DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600 focus:bg-red-50 dark:focus:bg-red-950">Archive</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div>
                <h3 className="text-[20px] leading-[1.25] font-[400] text-[#1c1c1c] line-clamp-2">{doc.title}</h3>
                <div className="text-sm text-[#5f5f5d] mt-1">{doc.sections} sections extracted</div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#eceae4]">
                <span className="text-sm text-[#5f5f5d]">Updated {doc.date}</span>
                <Badge variant={doc.status === 'Active' ? 'default' : 'secondary'} className="rounded-full px-2.5 py-0.5 font-[400]">
                  {doc.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
