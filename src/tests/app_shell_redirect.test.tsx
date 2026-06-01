import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AppShell } from '@/components/AppShell';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

describe('AppShell authentication redirects', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
    (useRouter as jest.Mock).mockReturnValue({ replace });
  });

  it('redirects unauthenticated users from protected pages to login', async () => {
    (usePathname as jest.Mock).mockReturnValue('/settings');
    (useSession as jest.Mock).mockReturnValue({ status: 'unauthenticated', data: null });

    render(
      <AppShell>
        <div>Protected content</div>
      </AppShell>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
    });
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('does not redirect unauthenticated users already on login', async () => {
    (usePathname as jest.Mock).mockReturnValue('/login');
    (useSession as jest.Mock).mockReturnValue({ status: 'unauthenticated', data: null });

    render(
      <AppShell>
        <div>Login form</div>
      </AppShell>,
    );

    expect(screen.getByText('Login form')).toBeInTheDocument();
    await waitFor(() => {
      expect(replace).not.toHaveBeenCalled();
    });
  });
});
