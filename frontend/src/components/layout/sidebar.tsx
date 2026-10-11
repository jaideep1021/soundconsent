import { NavLink } from 'react-router';
import { Home, FileText, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: Home, end: true },
  { name: 'Documents', href: '/dashboard/documents', icon: FileText },
  { name: 'Sessions', href: '/dashboard/sessions', icon: Users },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="w-64 border-r border-[#eceae4] bg-[#f7f4ed] flex flex-col h-full overflow-y-auto">
      <div className="h-16 flex items-center px-6 border-b border-[#eceae4]">
        <span className="font-[600] text-[#1c1c1c] text-xl tracking-tight">Teach-It-Back</span>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-base transition-colors',
                isActive
                  ? 'bg-[#1c1c1c]/[0.04] text-[#1c1c1c] font-[600]'
                  : 'text-[#5f5f5d] hover:bg-[#1c1c1c]/[0.03] hover:text-[#1c1c1c]'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-[#eceae4]">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-[#1c1c1c] text-[#fcfbf8] flex items-center justify-center text-sm font-[600]">
            CC
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-[600] text-[#1c1c1c]">Coordinator</span>
            <span className="text-xs text-[#5f5f5d]">Clinic Staff</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
