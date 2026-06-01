import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settings from '@/app/settings/page';
import { useAccount } from '@/context/AccountContext';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/context/AccountContext', () => ({
  useAccount: jest.fn(),
}));

describe('Settings page', () => {
  const refreshAccounts = jest.fn();
  const setSelectedAccountId = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
      text: async () => '',
    });
    (useAccount as jest.Mock).mockReturnValue({
      accounts: [
        {
          id: 'account-1',
          name: 'Main Account',
          googleAdsConfigs: [],
          googleAnalyticsConfigs: [],
          googleSearchConsoleConfigs: [],
          metaAdsConfigs: [],
          facebookPageConfigs: [],
          instagramPageConfigs: [],
        },
      ],
      refreshAccounts,
      selectedAccountId: 'account-1',
      setSelectedAccountId,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deletes the selected account through the dynamic account route', async () => {
    render(<Settings />);

    fireEvent.click(screen.getByTitle('Delete account'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/accounts/account-1', { method: 'DELETE' });
    });
    expect(refreshAccounts).toHaveBeenCalled();
    expect(setSelectedAccountId).toHaveBeenCalledWith('');
  });

  it('disables an active user through the dynamic user route', async () => {
    let userStatus = 'ACTIVE';
    (global.fetch as jest.Mock).mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/users' && !init) {
        return {
          ok: true,
          json: async () => ({
            users: [{
              id: 'user-1',
              email: 'client@example.com',
              name: 'Client User',
              role: 'CLIENT',
              status: userStatus,
              clientMainAccountAccesses: [],
            }],
          }),
          text: async () => '',
        };
      }

      if (url === '/api/users/user-1' && init?.method === 'PATCH') {
        userStatus = 'DISABLED';
        return {
          ok: true,
          json: async () => ({ user: { id: 'user-1', status: userStatus } }),
          text: async () => '',
        };
      }

      return {
        ok: true,
        json: async () => ({}),
        text: async () => '',
      };
    });

    render(<Settings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Disable' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/users/user-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DISABLED' }),
      });
    });
    expect(window.confirm).toHaveBeenCalledWith('Disable this user?');
    expect(await screen.findByRole('button', { name: 'Enable' })).toBeInTheDocument();
  });
});
