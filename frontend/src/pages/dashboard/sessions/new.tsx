import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router';

export default function NewSessionPage() {
  const navigate = useNavigate();
  const [createdSessionUrl, setCreatedSessionUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate generation of unique URL
    const uniqueId = Math.random().toString(36).substring(2, 9);
    setCreatedSessionUrl(`${window.location.origin}/session/${uniqueId}`);
  };

  const handleCopy = () => {
    if (createdSessionUrl) {
      navigator.clipboard.writeText(createdSessionUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-12 max-w-2xl">
      {/* Header */}
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          className="text-[#5f5f5d] hover:text-[#1c1c1c] hover:bg-[#1c1c1c]/[0.04] p-0 h-auto"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sessions
        </Button>
        <div>
          <h1 className="text-[48px] leading-[1] font-[600] text-[#1c1c1c] tracking-[-1.2px]">Create Session</h1>
          <p className="text-lg text-[#5f5f5d] mt-2">Generate a new teach-back consent link for a patient.</p>
        </div>
      </div>

      {!createdSessionUrl ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="patientName" className="text-sm font-[600] text-[#1c1c1c]">Patient Full Name</label>
              <Input 
                id="patientName" 
                placeholder="Jane Doe" 
                required
                className="bg-[#f7f4ed] border-[#eceae4] focus-visible:ring-blue-500/50"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="dob" className="text-sm font-[600] text-[#1c1c1c]">Date of Birth</label>
              <Input 
                id="dob" 
                type="date"
                required
                className="bg-[#f7f4ed] border-[#eceae4] focus-visible:ring-blue-500/50"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="document" className="text-sm font-[600] text-[#1c1c1c]">Select ICF Document</label>
              <select 
                id="document" 
                required
                className="w-full h-10 px-3 rounded-md bg-[#f7f4ed] border border-[#eceae4] text-sm text-[#1c1c1c] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="">Select a document...</option>
                <option value="1">Total Knee Arthroplasty</option>
                <option value="2">Cataract Surgery</option>
                <option value="3">General Anesthesia Consent</option>
              </select>
            </div>
          </div>

          <Button 
            type="submit"
            className="w-full bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90 shadow-[rgba(255,255,255,0.2)_0px_0.5px_0px_0px_inset,rgba(0,0,0,0.2)_0px_0px_0px_0.5px_inset,rgba(0,0,0,0.05)_0px_1px_2px_0px]"
          >
            Generate Patient Link
          </Button>
        </form>
      ) : (
        <Card className="bg-[#f7f4ed] border-[#eceae4] shadow-none">
          <CardContent className="p-6 space-y-6">
            <div>
              <h2 className="text-[20px] leading-[1.25] font-[400] text-[#1c1c1c]">Session Created Successfully</h2>
              <p className="text-sm text-[#5f5f5d] mt-1">Share this unique link with the patient to start their teach-back session.</p>
            </div>

            <div className="flex items-center gap-2">
              <Input 
                value={createdSessionUrl} 
                readOnly 
                className="bg-[#f7f4ed] border-[#eceae4]"
              />
              <Button 
                onClick={handleCopy}
                className="bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90 shrink-0"
              >
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'Copied' : 'Copy Link'}
              </Button>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-[#eceae4]">
              <Button 
                variant="outline" 
                className="border-[#eceae4] bg-[#f7f4ed] text-[#1c1c1c] hover:bg-[#1c1c1c]/[0.04]"
                onClick={() => setCreatedSessionUrl(null)}
              >
                Create Another
              </Button>
              <Button 
                className="bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90"
                onClick={() => navigate('/dashboard/sessions')}
              >
                Done
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
