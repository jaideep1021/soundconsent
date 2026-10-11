import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { UploadCloud, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

export function DocumentUploadModal({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'idle' | 'uploading' | 'parsing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);

  const simulateUpload = () => {
    setStep('uploading');
    setProgress(0);
    
    const uploadInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(uploadInterval);
          setStep('parsing');
          setTimeout(() => {
            setStep('success');
          }, 2000);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setTimeout(() => {
        setStep('idle');
        setProgress(0);
      }, 300);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-md bg-[#f7f4ed] border-[#eceae4]">
        <DialogHeader>
          <DialogTitle className="text-xl font-[600] text-[#1c1c1c]">Upload ICF Document</DialogTitle>
          <DialogDescription className="text-[#5f5f5d]">
            Upload a PDF consent form for AI parsing.
          </DialogDescription>
        </DialogHeader>

        {step === 'idle' && (
          <div 
            className="mt-4 border-2 border-dashed border-[#eceae4] rounded-xl p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#1c1c1c]/[0.4] hover:bg-[#1c1c1c]/[0.02] transition-colors"
            onClick={simulateUpload}
          >
            <div className="w-12 h-12 rounded-full bg-[#1c1c1c]/[0.04] flex items-center justify-center mb-4">
              <UploadCloud className="w-6 h-6 text-[#1c1c1c]" />
            </div>
            <h3 className="text-sm font-[600] text-[#1c1c1c]">Click to upload or drag and drop</h3>
            <p className="text-xs text-[#5f5f5d] mt-1">PDF (max. 10MB)</p>
          </div>
        )}

        {(step === 'uploading' || step === 'parsing') && (
          <div className="mt-4 space-y-6 py-6 text-center">
            <div className="flex justify-center">
              <div className="relative">
                <FileText className="w-12 h-12 text-[#1c1c1c]" />
                {step === 'parsing' && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500"></span>
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-[600] text-[#1c1c1c]">
                {step === 'uploading' ? 'Uploading document...' : 'AI is extracting sections...'}
              </h3>
              <Progress value={progress} className="h-2 bg-[#eceae4] [&>div]:bg-[#1c1c1c]" />
              {step === 'parsing' && (
                <div className="animate-pulse space-y-2 mt-4 text-left">
                  <div className="h-3 bg-[#eceae4] rounded w-3/4"></div>
                  <div className="h-3 bg-[#eceae4] rounded w-1/2"></div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="mt-4 space-y-6 py-6 text-center">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-700" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-[600] text-[#1c1c1c]">Upload Complete</h3>
              <p className="text-xs text-[#5f5f5d] mt-1">Successfully extracted 8 sections from the document.</p>
            </div>
            <Button 
              className="w-full bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90 shadow-[rgba(255,255,255,0.2)_0px_0.5px_0px_0px_inset,rgba(0,0,0,0.2)_0px_0px_0px_0.5px_inset,rgba(0,0,0,0.05)_0px_1px_2px_0px]"
              onClick={() => handleOpenChange(false)}
            >
              Review Extracted Sections
            </Button>
          </div>
        )}

        {step === 'error' && (
          <div className="mt-4 space-y-6 py-6 text-center">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-700" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-[600] text-[#1c1c1c]">Upload Failed</h3>
              <p className="text-xs text-red-600 mt-1">The file must be a valid PDF document.</p>
            </div>
            <Button 
              variant="outline"
              className="w-full border-[#eceae4] bg-[#f7f4ed] text-[#1c1c1c]"
              onClick={() => setStep('idle')}
            >
              Try Again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
