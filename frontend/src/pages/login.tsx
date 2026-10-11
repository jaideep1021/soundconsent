import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate login
    setTimeout(() => {
      setIsLoading(false);
      navigate('/dashboard');
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f4ed] p-4">
      <Card className="w-full max-w-md bg-[#f7f4ed] border-[#eceae4]">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-3xl font-[600] tracking-tight text-[#1c1c1c]">Welcome back</CardTitle>
          <CardDescription className="text-[#5f5f5d]">
            Log in to the Clinical Coordinator Dashboard
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-[600] text-[#1c1c1c]">Email</label>
              <Input 
                id="email" 
                type="email" 
                placeholder="coordinator@clinic.com" 
                required
                className="bg-[#f7f4ed] border-[#eceae4] focus-visible:ring-blue-500/50"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-[600] text-[#1c1c1c]">Password</label>
                <a href="#" className="text-sm text-[#5f5f5d] hover:text-[#1c1c1c] underline transition-colors">
                  Forgot password?
                </a>
              </div>
              <Input 
                id="password" 
                type="password" 
                required
                className="bg-[#f7f4ed] border-[#eceae4] focus-visible:ring-blue-500/50"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              className="w-full bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90 shadow-[rgba(255,255,255,0.2)_0px_0.5px_0px_0px_inset,rgba(0,0,0,0.2)_0px_0px_0px_0.5px_inset,rgba(0,0,0,0.05)_0px_1px_2px_0px]"
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Log in'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
