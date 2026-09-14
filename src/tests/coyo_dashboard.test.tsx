import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CoyoTasksDashboardView } from '@/components/dashboard/CoyoTasksDashboardView';
beforeEach(() => window.localStorage.clear());

it('preserves separate filters and switches Social to a calendar', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ tasks: [] }) });
  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await screen.findByText('Items by status');
  fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'dash search' } });
  fireEvent.click(screen.getByRole('button', { name: /^tasks$/i }));
  expect(screen.getByLabelText('Search')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: /^dash$/i }));
  expect(screen.getByLabelText('Search')).toHaveValue('dash search');
  fireEvent.click(screen.getByRole('button', { name: /^social$/i }));
  expect(screen.getByLabelText('Date type')).toHaveValue('postDate');
  fireEvent.click(screen.getByRole('button', { name: /^calendar$/i }));
  expect(screen.getByRole('button', { name: 'Next month' })).toBeInTheDocument();
});

it('defaults to seven days and saves the selected period', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ tasks: [] }) });
  const first = render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await screen.findByText('Items by status');
  expect(screen.getByLabelText('Period')).toHaveValue('7');
  fireEvent.change(screen.getByLabelText('Period'), { target: { value: '30' } });
  await waitFor(() => expect(JSON.parse(window.localStorage.getItem('coyo-tasks-dashboard-filters:v2')!).presets.dash).toBe('30'));
  first.unmount();
  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await screen.findByText('Items by status');
  expect(screen.getByLabelText('Period')).toHaveValue('30');
});

it('groups exact tag sets, sorts tasks, and opens a localized detail side panel', async () => {
  const today = new Date().toISOString();
  const tasks = [
    { id: 'later', displayId: 'AC-2', title: 'Later task', description: '<p>Attached brief</p><a href="/api/drive/media?fileId=wrong">old attachment</a>', status: 'IN_PROGRESS', category: 'TASK', workspace: 'AGENCY', tags: ['Urgent', 'Design'], caption: null, driveLink: 'https://drive.google.com/drive/folders/folder_1', client: { id: '1', name: 'Acme', prefix: 'AC' }, deliveryDate: today, createdAt: '2026-09-02T12:00:00Z', postDate: null, executionDate: null, updatedAt: today },
    { id: 'earlier', displayId: 'AC-1', title: 'Earlier task', description: null, status: 'APPROVED', category: 'TASK', workspace: 'AGENCY', tags: ['Design', 'Urgent'], caption: null, driveLink: null, client: { id: '1', name: 'Acme', prefix: 'AC' }, deliveryDate: today, createdAt: '2026-09-01T12:00:00Z', postDate: null, executionDate: null, updatedAt: today },
  ];
  (global.fetch as jest.Mock).mockImplementation(async input => String(input).startsWith('/api/coyo/files?')
    ? { ok: true, json: async () => ({ isFolder: true, name: 'Campaign', files: [{ id: 'image_1', name: '01.jpg', mimeType: 'image/jpeg' }, { id: 'image_2', name: '02.jpg', mimeType: 'image/jpeg' }] }) }
    : { ok: true, json: async () => ({ tasks }) });
  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await screen.findByText('Items by status');
  fireEvent.click(screen.getByRole('button', { name: /^tasks$/i }));
  expect(screen.getByRole('region', { name: 'Tasks tagged Design, Urgent' })).toBeInTheDocument();
  const earlier = screen.getByRole('button', { name: /AC-1 Earlier task/ });
  const later = screen.getByRole('button', { name: /AC-2 Later task/ });
  expect(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(later);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByTestId('coyo-detail-panel')).toHaveClass('h-dvh', 'sm:max-w-xl');
  expect(screen.getAllByText(new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(today))).length).toBeGreaterThan(0);
  expect(screen.getByRole('link', { name: /Open in Drive/ })).toHaveAttribute('href', 'https://drive.google.com/drive/folders/folder_1');
  expect(await screen.findByRole('button', { name: 'Next Drive file' })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: '01.jpg' })).toHaveAttribute('src', '/api/coyo/files/preview?mainAccountId=customer&taskId=later&fileId=image_1');
  fireEvent.click(screen.getByRole('button', { name: 'Next Drive file' }));
  expect(screen.getByRole('img', { name: '02.jpg' })).toBeInTheDocument();
});

it('renders social details as a phone-proportioned post in the side panel', async () => {
  const today = new Date().toISOString();
  const post = { id: 'post-1', displayId: 'AC-3', title: 'Launch post', description: 'Post description', status: 'IN_REVIEW', category: 'POST', workspace: 'SOCIAL', tags: ['Instagram'], caption: 'A launch caption', driveLink: 'https://drive.google.com/file/d/image_1/view', client: { id: '1', name: 'Acme', prefix: 'AC' }, deliveryDate: today, createdAt: today, postDate: today, executionDate: null, updatedAt: today };
  (global.fetch as jest.Mock).mockImplementation(async input => String(input).startsWith('/api/coyo/files?')
    ? { ok: true, json: async () => ({ isFolder: false, name: 'Post artwork', files: [{ id: 'image_1', name: 'post.jpg', mimeType: 'image/jpeg' }] }) }
    : { ok: true, json: async () => ({ tasks: [post] }) });

  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await screen.findByText('Items by status');
  fireEvent.click(screen.getByRole('button', { name: /^social$/i }));
  fireEvent.click(screen.getByRole('button', { name: /AC-3 Launch post/ }));

  expect(await screen.findByTestId('social-post-preview')).toHaveClass('aspect-[9/19.5]');
  expect(screen.getByText('Sponsored post preview')).toBeInTheDocument();
  expect(screen.getAllByText('A launch caption')).toHaveLength(2);
  expect(await screen.findByRole('img', { name: 'post.jpg' })).toBeInTheDocument();
});
