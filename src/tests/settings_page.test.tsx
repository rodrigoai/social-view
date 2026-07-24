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

  it('saves edited user details, password, and account access', async () => {
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
              status: 'ACTIVE',
              clientMainAccountAccesses: [],
            }],
          }),
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

    fireEvent.click(await screen.findByRole('button', { name: /Client User client@example.com/i }));

    fireEvent.change(screen.getByLabelText('User name'), {
      target: { value: 'Edited User' },
    });
    fireEvent.change(screen.getByLabelText('User email'), {
      target: { value: 'edited@example.com' },
    });
    fireEvent.change(screen.getByLabelText('User password'), {
      target: { value: 'new-password' },
    });
    fireEvent.click(screen.getByLabelText('Main Account'));
    fireEvent.click(screen.getByRole('button', { name: 'Save User' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/users/user-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Edited User',
          email: 'edited@example.com',
          role: 'CLIENT',
          mainAccountIds: ['account-1'],
          password: 'new-password',
        }),
      });
    });
  });

  it('deletes a user through the dynamic user route', async () => {
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
              status: 'ACTIVE',
              clientMainAccountAccesses: [],
            }],
          }),
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

    fireEvent.click(await screen.findByLabelText('Delete client@example.com'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/users/user-1', { method: 'DELETE' });
    });
    expect(window.confirm).toHaveBeenCalledWith('Delete client@example.com? This cannot be undone.');
  });

  it('filters users by search text', async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/users' && !init) {
        return {
          ok: true,
          json: async () => ({
            users: [
              {
                id: 'admin-1',
                email: 'admin@example.com',
                name: 'Admin User',
                role: 'ADMIN',
                status: 'ACTIVE',
                clientMainAccountAccesses: [],
              },
              {
                id: 'user-1',
                email: 'client@example.com',
                name: 'Client User',
                role: 'CLIENT',
                status: 'ACTIVE',
                clientMainAccountAccesses: [],
              },
            ],
          }),
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

    expect(await screen.findByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('Client User')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search users'), {
      target: { value: 'admin' },
    });

    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0);
    expect(screen.queryByText('Client User')).not.toBeInTheDocument();
  });

  it('filters clients by account name or id', () => {
    (useAccount as jest.Mock).mockReturnValue({
      accounts: [
        {
          id: 'client-north-1',
          name: 'Northwind',
          googleAdsConfigs: [],
          googleAnalyticsConfigs: [],
          googleSearchConsoleConfigs: [],
          metaAdsConfigs: [],
          facebookPageConfigs: [],
          instagramPageConfigs: [],
        },
        {
          id: 'client-south-2',
          name: 'Contoso',
          googleAdsConfigs: [],
          googleAnalyticsConfigs: [],
          googleSearchConsoleConfigs: [],
          metaAdsConfigs: [],
          facebookPageConfigs: [],
          instagramPageConfigs: [],
        },
      ],
      refreshAccounts,
      selectedAccountId: 'client-north-1',
      setSelectedAccountId,
    });

    render(<Settings />);

    expect(screen.getByRole('button', { name: /Northwind/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Contoso/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search clients'), {
      target: { value: 'south-2' },
    });

    expect(screen.queryByRole('button', { name: /Northwind/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Contoso/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search clients'), {
      target: { value: 'missing client' },
    });

    expect(screen.getByRole('status')).toHaveTextContent('No clients found.');
    expect(screen.queryByRole('button', { name: /Contoso/i })).not.toBeInTheDocument();
  });

  it('scrolls the user list without making the client list scrollable', () => {
    render(<Settings />);

    expect(screen.getByRole('region', { name: 'User list' })).toHaveClass('xl:overflow-y-auto');
    expect(screen.getByRole('region', { name: 'Client list' })).not.toHaveClass('overflow-y-auto');
  });
});
