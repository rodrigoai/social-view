import Link from 'next/link';
import { LayoutDashboard, Settings } from 'lucide-react';

export function Sidebar() {
  return (
    <aside className="fixed z-20 h-full top-0 left-0 pt-16 flex flex-shrink-0 flex-col w-64 transition-width duration-75 hidden lg:flex transition-colors duration-300">
      <div className="relative flex-1 flex flex-col min-h-0 border-r border-border-custom bg-card pt-0">
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <div className="flex-1 px-3 bg-card divide-y space-y-1">
            <ul className="space-y-2 pb-2">
              <li>
                <Link href="/" className="text-base text-foreground font-medium rounded-lg flex items-center p-2 hover:bg-accent-custom group transition-colors">
                  <LayoutDashboard className="w-5 h-5 text-muted group-hover:text-blue-600 transition duration-75" />
                  <span className="ml-3 group-hover:text-blue-600 transition duration-75">Dashboard</span>
                </Link>
              </li>
              <li>
                <Link href="/settings" className="text-base text-foreground font-medium rounded-lg flex items-center p-2 hover:bg-accent-custom group transition-colors">
                  <Settings className="w-5 h-5 text-muted group-hover:text-blue-600 transition duration-75" />
                  <span className="ml-3 group-hover:text-blue-600 transition duration-75">Settings</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </aside>
  );
}
