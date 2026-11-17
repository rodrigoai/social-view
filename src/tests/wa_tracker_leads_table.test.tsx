import { render, screen, within } from '@testing-library/react';
import { WaTrackerLeadsTable } from '@/components/dashboard/WaTrackerLeadsTable';

it('shows the saved dropdown selection beside contact details when available', async () => {
  const baseLead = { status: 'Not Qualified', source: 'Orgânico', campaign: 'Orgânico' };
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [
        { ...baseLead, id: '1', name: 'Maria Silva', dropdown_label: 'Departamento', dropdown_value: 'Vendas' },
        { ...baseLead, id: '2', name: 'Joao Santos', dropdown_label: 'Department', dropdown_value: null },
        { ...baseLead, id: '3', name: 'Ana Costa' },
        { ...baseLead, id: '4', name: 'Rita Lima', dropdown_label: null, dropdown_value: 'Support' },
      ],
    }),
  });

  try {
    render(<WaTrackerLeadsTable selectedAccountId="main-1" filters={{ period: '7d', campaign: 'all' }} onOpenKpi={jest.fn()} />);

    const selectedLead = within(await screen.findByRole('row', { name: /Maria Silva/ }));
    expect(selectedLead.getByText('Departamento')).toBeInTheDocument();
    expect(selectedLead.getByText('Vendas')).toBeInTheDocument();
    expect(screen.getAllByRole('term')).toHaveLength(2);
    const unlabeledLead = within(screen.getByRole('row', { name: /Rita Lima/ }));
    expect(unlabeledLead.getByText('Form selection')).toBeInTheDocument();
    expect(unlabeledLead.getByText('Support')).toBeInTheDocument();
  } finally {
    global.fetch = originalFetch;
  }
});
