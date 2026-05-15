'use client';

import Link from 'next/link'; 
import { Settings, User, Bell, Sun, Moon, LogOut } from 'lucide-react';
import { AccountSwitcher } from './AccountSwitcher';
import { useTheme } from '@/context/ThemeContext';
import { signOut, useSession } from 'next-auth/react';

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  const handleSignOut = () => {
    localStorage.removeItem('selectedAccountId');
    Object.keys(localStorage)
      .filter((key) => key.startsWith('dashboard-cache:'))
      .forEach((key) => localStorage.removeItem(key));
    void signOut({ callbackUrl: '/login' });
  };

  return (
    <nav className="bg-card border-b border-border-custom fixed w-full z-30 top-0 transition-colors duration-300">
      <div className="px-3 py-3 lg:px-5 lg:pl-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-start gap-4 lg:gap-8">
            <Link href="/" className="text-xl font-bold flex items-center lg:ml-2.5">
              <span className="self-center whitespace-nowrap text-blue-600 tracking-tight">SocialView</span>
            </Link>
            <AccountSwitcher />
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="text-muted hover:text-foreground transition-colors p-2 rounded-lg hover:bg-accent-custom"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            <button className="text-muted hover:text-foreground transition-colors"><Bell className="h-5 w-5" /></button>
            {isAdmin && (
              <Link href="/settings" className="text-muted hover:text-foreground transition-colors">
                <Settings className="h-5 w-5" />
              </Link>
            )}
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-sm cursor-pointer">
              <User className="h-4 w-4" />
            </div>
            <button
              onClick={handleSignOut}
              className="text-muted hover:text-foreground transition-colors"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
