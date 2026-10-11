import { NavLink } from "react-router";
import { Home, FileText, Users, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: Home, end: true },
  { name: "Documents", href: "/dashboard/documents", icon: FileText },
  { name: "Sessions", href: "/dashboard/sessions", icon: Users },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="w-full md:w-64 shrink-0 border-r border-border bg-cream flex flex-col md:h-full overflow-y-auto">
      <div className="hidden md:flex h-16 items-center px-6 border-b border-border">
        <span className="font-[600] text-charcoal text-xl tracking-tight">
          Teach-It-Back
        </span>
      </div>
      <nav className="grid grid-cols-4 md:block md:flex-1 px-2 md:px-4 py-2 md:py-6 md:space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex min-h-11 flex-col md:flex-row items-center justify-center md:justify-start gap-2 px-1 md:px-3 py-2 rounded-md text-xs md:text-base transition-colors",
                isActive
                  ? "bg-charcoal/[0.04] text-charcoal font-[600]"
                  : "text-muted-foreground hover:bg-charcoal/[0.03] hover:text-charcoal",
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>
      <div className="hidden md:block p-4 border-t border-border">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-charcoal text-off-white flex items-center justify-center text-sm font-[600]">
            CC
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-[600] text-charcoal">
              Coordinator
            </span>
            <span className="text-xs text-muted-foreground">Clinic Staff</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
