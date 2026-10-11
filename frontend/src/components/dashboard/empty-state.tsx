import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-[#eceae4] rounded-xl bg-[#f7f4ed]">
      <div className="w-12 h-12 rounded-full bg-[#1c1c1c]/[0.04] flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-[#1c1c1c]" />
      </div>
      <h3 className="text-xl font-[600] text-[#1c1c1c] tracking-tight">{title}</h3>
      <p className="text-sm text-[#5f5f5d] max-w-sm mt-1 mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="bg-[#1c1c1c] text-[#fcfbf8] hover:bg-[#1c1c1c]/90 shadow-[rgba(255,255,255,0.2)_0px_0.5px_0px_0px_inset,rgba(0,0,0,0.2)_0px_0px_0px_0.5px_inset,rgba(0,0,0,0.05)_0px_1px_2px_0px]"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
