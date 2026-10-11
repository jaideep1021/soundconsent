import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useSessionStore } from '@/stores/session-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function IdentityVerificationPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, isLoading, initializeSession, verifyIdentity } = useSessionStore();
  
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (sessionId && !session) {
      initializeSession(sessionId);
    }
  }, [sessionId, session, initializeSession]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (verifyIdentity(name, dob)) {
      navigate(`/session/${sessionId}/overview`);
    } else {
      setError("We couldn't verify your details. Please check and try again.");
    }
  };

  if (isLoading || !session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#1c1c1c]" />
        <p className="text-[#5f5f5d]">Loading your session...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
      <Card className="border-[#eceae4] shadow-none bg-[#f7f4ed]">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-semibold tracking-tight text-[#1c1c1c]">
            Welcome
          </CardTitle>
          <CardDescription className="text-[#5f5f5d] text-base">
            Please confirm your identity to review your consent documents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-[#1c1c1c]">
                Full Name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jane Doe"
                className="bg-[#f7f4ed] border-[#eceae4] focus-visible:ring-[#3b82f6] text-base h-12"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="dob" className="text-sm font-medium text-[#1c1c1c]">
                Date of Birth
              </label>
              <Input
                id="dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="bg-[#f7f4ed] border-[#eceae4] focus-visible:ring-[#3b82f6] text-base h-12"
                required
              />
            </div>

            {error && (
              <p className="text-[#ef4444] text-sm text-center">
                {error}
              </p>
            )}

            <Button 
              type="submit" 
              className="w-full bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90 rounded-[6px] h-12 text-base shadow-[var(--shadow-inset-button)]"
            >
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <div className="mt-8 text-center text-sm text-[#5f5f5d]">
        Having trouble? Contact your care team.
      </div>
    </div>
  );
}
