import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useNavigate } from "react-router";

export function Header() {
  const navigate = useNavigate();

  const handleLogout = () => {
    useAuthStore.getState().logout();
    navigate("/login");
  };

  return (
    <header
      data-dashboard-header
      className="h-16 border-b border-border bg-cream flex items-center justify-between px-6 shrink-0"
    >
      <div className="flex-1">
        {/* Optional: Add breadcrumbs or page title here later */}
      </div>
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Account menu"
            className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:text-accent-foreground rounded-full w-11 h-11 bg-charcoal/[0.04]"
          >
            <User className="w-4 h-4 text-charcoal" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 bg-cream border-border"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-[600] text-charcoal">
                My Account
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={() => navigate("/dashboard/settings")}
                className="text-charcoal focus:bg-charcoal/[0.04]"
              >
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
