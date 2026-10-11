import { Outlet } from 'react-router';
import { Sidebar } from './sidebar';
import { Header } from './header';

export function DashboardLayout() {
  return (
    <div className="flex h-screen bg-[#f7f4ed] overflow-hidden text-[#1c1c1c] font-sans">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
