'use client';

import { useEffect } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { AccountProvider } from '@/context/AccountContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Layout } from '@/components/Layout';

function ProtectedApp({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';

  useEffect(() => {
    if (!isLogin && status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [isLogin, router, status]);

  if (isLogin) return <>{children}</>;

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <AccountProvider>
      <Layout>{children}</Layout>
    </AccountProvider>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <ProtectedApp>{children}</ProtectedApp>
      </ThemeProvider>
    </SessionProvider>
  );
}
