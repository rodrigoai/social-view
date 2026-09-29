import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from '@/app/page';

const setSelectedAccountId = jest.fn();

jest.mock('@/context/AccountContext', () => ({
  useAccount: () => ({
    accounts: [
      { id: 'account-a', name: 'Account A' },
      { id: 'account-b', name: 'Account B', coyoClientAcronym: 'BB' },
    ],
    selectedAccountId: 'account-a',
    selectedAccount: { id: 'account-a', name: 'Account A' },
    setSelectedAccountId,
    isLoading: false,
  }),
}));

jest.mock('@/components/dashboard/GoogleDashboardView', () => ({ GoogleDashboardView: () => <div>Google dashboard</div> }));
jest.mock('@/components/dashboard/MetaDashboardView', () => ({ MetaDashboardView: () => <div>Meta dashboard</div> }));
jest.mock('@/components/dashboard/WaTrackerDashboardView', () => ({ WaTrackerDashboardView: () => <div>WA dashboard</div> }));
jest.mock('@/components/dashboard/CoyoTasksDashboardView', () => ({
  CoyoTasksDashboardView: ({ sharedTaskId }: { sharedTaskId?: string | null }) => <div>Coyô shared item {sharedTaskId}</div>,
}));
jest.mock('@/components/KpiModal', () => ({ KpiModal: () => null }));

beforeEach(() => {
  setSelectedAccountId.mockClear();
  window.history.replaceState({}, '', '/?account=account-b&coyoTask=task-77');
});

it('switches to the shared account and opens the Coyô dashboard from its deep link', async () => {
  render(<Dashboard />);

  await waitFor(() => expect(screen.getByText('Coyô shared item task-77')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Coyô Tasks' })).toHaveClass('bg-blue-600');
  expect(setSelectedAccountId).toHaveBeenCalledWith('account-b');
});
