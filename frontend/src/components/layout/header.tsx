
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { User, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';

export function Header() {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/login');
  };

  return (
    <header className="h-16 border-b border-[#eceae4] bg-[#f7f4ed] flex items-center justify-between px-6 shrink-0">
      <div className="flex-1">
        {/* Optional: Add breadcrumbs or page title here later */}
      </div>
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:text-accent-foreground rounded-full w-8 h-8 bg-[#1c1c1c]/[0.04]">
            <User className="w-4 h-4 text-[#1c1c1c]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-[#f7f4ed] border-[#eceae4]">
            <DropdownMenuLabel className="font-[600] text-[#1c1c1c]">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#eceae4]" />
            <DropdownMenuItem className="text-[#1c1c1c] focus:bg-[#1c1c1c]/[0.04]">
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:bg-red-50 dark:focus:bg-red-950">
              <LogOut className="w-4 h-4 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
