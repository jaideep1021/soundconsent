import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Save } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-12 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-[48px] leading-[1] font-[600] text-[#1c1c1c] tracking-[-1.2px]">Settings</h1>
        <p className="text-lg text-[#5f5f5d] mt-2">Manage consent protocols, AI behavior, and clinic preferences.</p>
      </div>

      <div className="space-y-8">
        {/* AI Behavior */}
        <Card className="bg-[#f7f4ed] border-[#eceae4] shadow-none">
          <CardHeader>
            <CardTitle className="text-[20px] font-[600] text-[#1c1c1c]">AI Assessment Strictness</CardTitle>
            <CardDescription className="text-[#5f5f5d]">
              Configure how rigorously the AI evaluates patient comprehension against the ICF.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-[600] text-[#1c1c1c]">Strictness Level</label>
              <select className="w-full h-10 px-3 rounded-md bg-[#f7f4ed] border border-[#eceae4] text-sm text-[#1c1c1c] focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                <option value="balanced">Balanced (Recommended for standard clinical trials)</option>
                <option value="strict">Strict (High-risk surgical procedures)</option>
                <option value="lenient">Lenient (Low-risk observational studies)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-[600] text-[#1c1c1c]">Retry Attempts Before Flagging</label>
              <Input 
                type="number" 
                defaultValue="2" 
                className="bg-[#f7f4ed] border-[#eceae4]"
              />
              <span className="text-xs text-[#5f5f5d]">Number of times AI prompts patient to re-explain before marking as partial understanding.</span>
            </div>
          </CardContent>
        </Card>

        {/* Workflow */}
        <Card className="bg-[#f7f4ed] border-[#eceae4] shadow-none">
          <CardHeader>
            <CardTitle className="text-[20px] font-[600] text-[#1c1c1c]">Consent Workflow</CardTitle>
            <CardDescription className="text-[#5f5f5d]">
              Adjust progression triggers and patient interface options.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-[#eceae4]">
              <div>
                <div className="font-[600] text-sm text-[#1c1c1c]">Auto-advance Sections</div>
                <div className="text-xs text-[#5f5f5d]">Automatically proceed when understanding threshold is met.</div>
              </div>
              <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-[#eceae4] text-[#1c1c1c] focus:ring-blue-500/50" />
            </div>

            <div className="flex items-center justify-between py-2 border-b border-[#eceae4]">
              <div>
                <div className="font-[600] text-sm text-[#1c1c1c]">Require Verbal Confirmation</div>
                <div className="text-xs text-[#5f5f5d]">Require explicit voice agreement before finalizing session.</div>
              </div>
              <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-[#eceae4] text-[#1c1c1c] focus:ring-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex justify-end">
          <Button className="bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90 shadow-[rgba(255,255,255,0.2)_0px_0.5px_0px_0px_inset,rgba(0,0,0,0.2)_0px_0px_0px_0.5px_inset,rgba(0,0,0,0.05)_0px_1px_2px_0px]">
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
