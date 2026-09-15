import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CoyoTasksDashboardView } from '@/components/dashboard/CoyoTasksDashboardView';
let objectUrlSequence = 0;
const createObjectUrl = jest.fn((blob: Blob): string => `blob:preview-${blob.size}-${++objectUrlSequence}`);
const revokeObjectUrl = jest.fn();
Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });
beforeEach(() => { window.localStorage.clear(); objectUrlSequence = 0; createObjectUrl.mockClear(); revokeObjectUrl.mockClear(); });

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
  expect(await screen.findByRole('img', { name: '01.jpg' })).toHaveAttribute('src', '/api/coyo/files/preview?mainAccountId=customer&taskId=later&fileId=image_1');
  fireEvent.click(screen.getByRole('button', { name: 'Next Drive file' }));
  expect(await screen.findByRole('img', { name: '02.jpg' })).toBeInTheDocument();
});

it('filters tasks by multiple tags and can disable tag grouping', async () => {
  const today = new Date().toISOString();
  const base = { description: null, status: 'BACKLOG', category: 'TASK', workspace: 'AGENCY', caption: null, driveLink: null, client: { id: '1', name: 'Acme', prefix: 'AC' }, deliveryDate: today, createdAt: today, postDate: null, executionDate: null, updatedAt: today };
  const tasks = [
    { ...base, id: 'design', displayId: 'AC-10', title: 'Design task', tags: ['Design'] },
    { ...base, id: 'copy', displayId: 'AC-11', title: 'Copy task', tags: ['Copy'] },
    { ...base, id: 'both', displayId: 'AC-12', title: 'Combined task', tags: ['Design', 'Copy'] },
  ];
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ tasks }) });

  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await screen.findByText('Items by status');
  fireEvent.click(screen.getByRole('button', { name: /^tasks$/i }));

  expect(screen.getByRole('checkbox', { name: 'Group by tags' })).toBeChecked();
  fireEvent.click(screen.getByLabelText('Tag filters'));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Filter by tag Design' }));
  expect(screen.getByRole('button', { name: 'AC-10 Design task' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'AC-12 Combined task' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'AC-11 Copy task' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('checkbox', { name: 'Filter by tag Copy' }));
  expect(screen.getByRole('button', { name: 'AC-11 Copy task' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Group by tags' }));
  expect(screen.queryByRole('region', { name: 'Tasks tagged Design' })).not.toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Tags' })).toBeInTheDocument();
});

it('renders social details as a phone-proportioned post in the side panel', async () => {
  const today = new Date().toISOString();
  const post = { id: 'post-1', displayId: 'AC-3', title: 'Launch post', description: 'Post description', status: 'IN_REVIEW', category: 'POST', postFormat: ['Post', 'Story'], workspace: 'SOCIAL', tags: ['Instagram'], caption: 'A launch caption', driveLink: 'https://drive.google.com/drive/folders/folder_1', client: { id: '1', name: 'Acme', prefix: 'AC' }, deliveryDate: today, createdAt: today, postDate: today, executionDate: null, updatedAt: today };
  (global.fetch as jest.Mock).mockImplementation(async input => String(input).startsWith('/api/coyo/files?')
    ? { ok: true, json: async () => ({ isFolder: true, name: 'Campaign', files: [{ id: 'image_1', name: 'post.jpg', mimeType: 'image/jpeg' }, { id: 'story_1', name: 'story.mp4', mimeType: 'video/mp4' }], formats: [{ format: 'Post', files: [{ id: 'image_1', name: 'post.jpg', mimeType: 'image/jpeg' }] }, { format: 'Story', files: [{ id: 'story_1', name: 'story.mp4', mimeType: 'video/mp4' }] }] }) }
    : { ok: true, json: async () => ({ tasks: [post] }) });

  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await screen.findByText('Items by status');
  fireEvent.click(screen.getByRole('button', { name: /^social$/i }));
  fireEvent.click(screen.getByRole('button', { name: /AC-3 Launch post/ }));

  expect(await screen.findByTestId('social-post-preview')).toHaveClass('aspect-[9/19.5]');
  expect(screen.getByText('Post preview')).toBeInTheDocument();
  expect(screen.getAllByText('A launch caption')).toHaveLength(2);
  expect(await screen.findByRole('img', { name: 'post.jpg' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Story' }));
  expect(screen.getByTestId('story-preview')).toHaveClass('aspect-[9/19.5]');
  expect(screen.getByText('Send message')).toBeInTheDocument();
  expect(screen.getByTitle('Drive preview: story.mp4')).toHaveClass('object-cover');
});

it('shows post types, emphasizes post dates, and makes the whole post row clickable', async () => {
  const today = new Date().toISOString();
  const post = { id: 'post-table', displayId: 'AC-5', title: 'Social table post', description: null, status: 'CREATED', category: 'POST', postFormat: ['Post', 'Story'], workspace: 'SOCIAL', tags: [], caption: null, driveLink: null, client: { id: '1', name: 'Acme', prefix: 'AC' }, deliveryDate: today, createdAt: today, postDate: today, executionDate: today, updatedAt: today };
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ tasks: [post] }) });

  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await screen.findByText('Items by status');
  fireEvent.click(screen.getByRole('button', { name: /^social$/i }));

  expect(screen.queryByRole('columnheader', { name: 'Execution' })).not.toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'Resources' })).not.toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Post type' })).toBeInTheDocument();
  expect(screen.getByText('Story')).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Post date' })).toHaveClass('text-emerald-800');
  const row = screen.getByRole('button', { name: 'AC-5 Social table post' });
  expect(row).toHaveClass('cursor-pointer');
  fireEvent.click(row);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

it('caches Drive images only while the detail side panel is open', async () => {
  const today = new Date().toISOString();
  const task = { id: 'cache-task', displayId: 'AC-4', title: 'Cached artwork', description: null, status: 'IN_PROGRESS', category: 'TASK', workspace: 'AGENCY', tags: [], caption: null, driveLink: 'https://drive.google.com/drive/folders/folder_1', client: { id: '1', name: 'Acme', prefix: 'AC' }, deliveryDate: today, createdAt: today, postDate: null, executionDate: null, updatedAt: today };
  (global.fetch as jest.Mock).mockImplementation(async input => {
    const url = String(input);
    if (url.startsWith('/api/coyo/files?')) return { ok: true, json: async () => ({ isFolder: true, name: 'Artwork', files: [{ id: 'image_1', name: '01.jpg', mimeType: 'image/jpeg' }, { id: 'image_2', name: '02.jpg', mimeType: 'image/jpeg' }] }) };
    if (url.startsWith('/api/coyo/files/preview?')) return { ok: true, blob: async () => new Blob(['image'], { type: 'image/jpeg' }) };
    return { ok: true, json: async () => ({ tasks: [task] }) };
  });

  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await screen.findByText('Items by status');
  fireEvent.click(screen.getByRole('button', { name: /^tasks$/i }));
  fireEvent.click(screen.getByRole('button', { name: /AC-4 Cached artwork/ }));

  await waitFor(() => expect(createObjectUrl).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('img', { name: '01.jpg' }).getAttribute('src')).toMatch(/^blob:preview-/);
  fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
  expect(revokeObjectUrl).toHaveBeenCalledTimes(2);
});
