import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from '@/app/page';

const setSelectedAccountId = jest.fn();

jest.mock('@/context/AccountContext', () => ({
  useAccount: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const accounts = [
      { id: 'account-a', name: 'Account A' },
      { id: 'account-b', name: 'Account B', coyoClientAcronym: 'BB' },
    ];
    const [selectedAccountId, selectAccount] = React.useState('account-a');
    return {
      accounts,
      selectedAccountId,
      selectedAccount: accounts.find(account => account.id === selectedAccountId),
      setSelectedAccountId: (id: string | null) => { setSelectedAccountId(id); if (id) selectAccount(id); },
      isLoading: false,
    };
  },
}));

jest.mock('@/components/dashboard/GoogleDashboardView', () => ({ GoogleDashboardView: () => <div>Google dashboard</div> }));
jest.mock('@/components/dashboard/MetaDashboardView', () => ({ MetaDashboardView: () => <div>Meta dashboard</div> }));
jest.mock('@/components/dashboard/WaTrackerDashboardView', () => ({ WaTrackerDashboardView: () => <div>WA dashboard</div> }));
jest.mock('@/components/dashboard/CoyoTasksDashboardView', () => ({
  CoyoTasksDashboardView: ({ selectedAccountId, sharedTaskId }: { selectedAccountId: string; sharedTaskId?: string | null }) => <div>Coyô shared item {sharedTaskId} for {selectedAccountId}</div>,
}));
jest.mock('@/components/KpiModal', () => ({ KpiModal: () => null }));

beforeEach(() => {
  setSelectedAccountId.mockClear();
  window.history.replaceState({}, '', '/?account=account-b&coyoTask=task-77');
});

it('switches to the shared account and opens the Coyô dashboard from its deep link', async () => {
  render(<Dashboard />);

  await waitFor(() => expect(screen.getByText('Coyô shared item task-77 for account-b')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Coyô Tasks' })).toHaveClass('bg-blue-600');
  expect(setSelectedAccountId).toHaveBeenCalledWith('account-b');
});
