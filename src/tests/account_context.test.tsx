import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AccountProvider, useAccount } from '@/context/AccountContext';

function AccountProbe() {
  const {
    accounts,
    selectedAccountId,
    selectedAccount,
    isLoading,
    setSelectedAccountId,
    refreshAccounts,
  } = useAccount();

  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="count">{accounts.length}</div>
      <div data-testid="selected-id">{selectedAccountId ?? 'none'}</div>
      <div data-testid="selected-name">{selectedAccount?.name ?? 'none'}</div>
      <button type="button" onClick={() => setSelectedAccountId('account-2')}>
        Select second
      </button>
      <button type="button" onClick={() => setSelectedAccountId(null)}>
        Clear selection
      </button>
      <button type="button" onClick={() => void refreshAccounts()}>
        Refresh
      </button>
    </div>
  );
}

function UseAccountOutsideProvider() {
  useAccount();
  return null;
}

const mockAccounts = [
  { id: 'account-1', name: 'First Account' },
  { id: 'account-2', name: 'Second Account' },
];

describe('AccountContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ accounts: mockAccounts }),
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('selects and persists the first account when no saved account exists', async () => {
    render(
      <AccountProvider>
        <AccountProbe />
      </AccountProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    expect(global.fetch).toHaveBeenCalledWith('/api/accounts');
    expect(screen.getByTestId('count')).toHaveTextContent('2');
    expect(screen.getByTestId('selected-id')).toHaveTextContent('account-1');
    expect(screen.getByTestId('selected-name')).toHaveTextContent('First Account');
    expect(localStorage.getItem('selectedAccountId')).toBe('account-1');
  });

  it('keeps a saved selection when the fetched accounts still contain it', async () => {
    localStorage.setItem('selectedAccountId', 'account-2');

    render(
      <AccountProvider>
        <AccountProbe />
      </AccountProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('selected-id')).toHaveTextContent('account-2'));

    expect(screen.getByTestId('selected-name')).toHaveTextContent('Second Account');
    expect(localStorage.getItem('selectedAccountId')).toBe('account-2');
  });

  it('falls back to the first account when the saved selection is stale', async () => {
    localStorage.setItem('selectedAccountId', 'deleted-account');

    render(
      <AccountProvider>
        <AccountProbe />
      </AccountProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('selected-id')).toHaveTextContent('account-1'));

    expect(localStorage.getItem('selectedAccountId')).toBe('account-1');
  });

  it('clears the selected account when the API returns no accounts', async () => {
    localStorage.setItem('selectedAccountId', 'account-1');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ accounts: [] }),
    });

    render(
      <AccountProvider>
        <AccountProbe />
      </AccountProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(screen.getByTestId('selected-id')).toHaveTextContent('none');
    expect(localStorage.getItem('selectedAccountId')).toBe('account-1');
  });

  it('lets users change or clear the selected account explicitly', async () => {
    render(
      <AccountProvider>
        <AccountProbe />
      </AccountProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('selected-id')).toHaveTextContent('account-1'));

    await act(async () => {
      screen.getByText('Select second').click();
    });

    expect(screen.getByTestId('selected-id')).toHaveTextContent('account-2');
    expect(localStorage.getItem('selectedAccountId')).toBe('account-2');

    await act(async () => {
      screen.getByText('Clear selection').click();
    });

    expect(screen.getByTestId('selected-id')).toHaveTextContent('none');
    expect(localStorage.getItem('selectedAccountId')).toBeNull();
  });

  it('refreshAccounts re-fetches account data and repairs stale selections', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accounts: mockAccounts }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accounts: [{ id: 'account-3', name: 'Replacement Account' }] }),
      });

    render(
      <AccountProvider>
        <AccountProbe />
      </AccountProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('selected-id')).toHaveTextContent('account-1'));

    await act(async () => {
      screen.getByText('Refresh').click();
    });

    await waitFor(() => expect(screen.getByTestId('selected-id')).toHaveTextContent('account-3'));
    expect(screen.getByTestId('selected-name')).toHaveTextContent('Replacement Account');
    expect(localStorage.getItem('selectedAccountId')).toBe('account-3');
  });

  it('throws a clear error when useAccount is rendered outside the provider', () => {
    expect(() => render(<UseAccountOutsideProvider />)).toThrow(
      'useAccount must be used within an AccountProvider',
    );
  });
});
