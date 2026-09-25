import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CoyoTasksDashboardView } from '@/components/dashboard/CoyoTasksDashboardView';
let objectUrlSequence = 0;
const createObjectUrl = jest.fn((blob: Blob): string => `blob:preview-${blob.size}-${++objectUrlSequence}`);
const revokeObjectUrl = jest.fn();
Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });
beforeEach(() => { window.localStorage.clear(); objectUrlSequence = 0; createObjectUrl.mockClear(); revokeObjectUrl.mockClear(); (global.fetch as jest.Mock).mockReset(); });

it('creates a Backlog task from the Coyô tab modal and refreshes the list', async () => {
  (global.fetch as jest.Mock).mockImplementation(async (_input, init) => init?.method === 'POST'
    ? { ok: true, status: 201, json: async () => ({ task: { id: 'new-task', displayId: 'AC-42', status: 'BACKLOG', attachments: [] } }) }
    : { ok: true, json: async () => ({ tasks: [] }) });

  render(<CoyoTasksDashboardView selectedAccountId="customer" selectedAccountName="Acme" selectedClientAcronym="AC" />);
  await waitFor(() => expect(screen.queryByText('Loading Coyô tasks…')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'New Task' }));

  expect(screen.getByRole('dialog', { name: 'Create a Coyô task' })).toBeInTheDocument();
  expect(screen.getByLabelText('User')).toHaveValue('admin@example.com');
  expect(screen.getByLabelText('Client')).toHaveValue('Acme (AC)');
  const today = new Date();
  const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  expect(screen.getByLabelText('Due date')).toHaveValue(todayValue);
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Campaign brief' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Prepare the campaign assets.' } });
  fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-09-30' } });
  fireEvent.change(screen.getByLabelText('Workspace'), { target: { value: 'SOFTWARE' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create task' }));

  expect(await screen.findByText('Task added to Backlog')).toBeInTheDocument();
  expect(screen.getByText('AC-42')).toBeInTheDocument();
  const postCall = (global.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'POST');
  const body = postCall?.[1].body as FormData;
  expect(Object.fromEntries(body.entries())).toEqual(expect.objectContaining({ mainAccountId: 'customer', title: 'Campaign brief', description: 'Prepare the campaign assets.', dueDate: '2026-09-30', workspace: 'SOFTWARE' }));
  await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.filter(([, init]) => !init?.method)).toHaveLength(2));
});

it('previews description attachments for Backlog tasks in the side panel', async () => {
  const today = new Date().toISOString();
  const backlog = { id: 'backlog-1', displayId: 'AC-50', title: 'New brief', description: '<p>Brief attached</p><img src="/api/drive/media?fileId=image_1"><img src="/api/drive/media?fileId=image_2">', status: 'BACKLOG', category: 'TASK', workspace: 'AGENCY', tags: [], caption: null, driveLink: null, client: { id: '1', name: 'Acme', prefix: 'AC' }, deliveryDate: today, createdAt: today, postDate: null, executionDate: null, updatedAt: today };
  (global.fetch as jest.Mock).mockImplementation(async input => {
    const url = String(input);
    if (url.startsWith('/api/coyo/files?')) return { ok: true, json: async () => ({ isFolder: false, name: 'Artwork.png', driveUrl: 'https://drive.google.com/drive/folders/backlog_folder', files: [{ id: 'image_1', name: 'Artwork.png', mimeType: 'image/png' }, { id: 'image_2', name: 'Brief.png', mimeType: 'image/png' }] }) };
    if (url.startsWith('/api/coyo/files/preview?')) return { ok: true, blob: async () => new Blob([url]) };
    return { ok: true, json: async () => ({ tasks: [backlog] }) };
  });

  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await waitFor(() => expect(screen.queryByText('Loading Coyô tasks…')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /^tasks$/i }));
  fireEvent.click(screen.getByRole('button', { name: /AC-50 New brief/ }));

  expect(await screen.findByRole('button', { name: 'Preview Artwork.png' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Preview Brief.png' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open in Google Drive' })).toHaveAttribute('href', 'https://drive.google.com/drive/folders/backlog_folder');
  await waitFor(() => expect(createObjectUrl).toHaveBeenCalledTimes(2));
  const previewRequests = (global.fetch as jest.Mock).mock.calls.map(([input]) => String(input)).filter(url => url.startsWith('/api/coyo/files/preview?'));
  expect(previewRequests).toEqual(expect.arrayContaining([
    '/api/coyo/files/preview?mainAccountId=customer&taskId=backlog-1&fileId=image_1',
    '/api/coyo/files/preview?mainAccountId=customer&taskId=backlog-1&fileId=image_2',
  ]));
  fireEvent.click(screen.getByRole('button', { name: 'Preview Brief.png' }));
  expect(await screen.findByRole('img', { name: 'Brief.png' })).toBeInTheDocument();
});

it('renders API task descriptions as rich text in the detail panel', async () => {
  const today = new Date().toISOString();
  const task = { id: 'rich-text-1', displayId: 'AC-51', title: 'Formatted brief', description: '<p>Use the <strong>primary logo</strong>.</p><ul><li>Desktop</li><li>Mobile</li></ul>', status: 'IN_PROGRESS', category: 'TASK', workspace: 'AGENCY', tags: [], caption: null, driveLink: null, client: { id: '1', name: 'Acme', prefix: 'AC' }, deliveryDate: today, createdAt: today, postDate: null, executionDate: null, updatedAt: today };
  (global.fetch as jest.Mock).mockImplementation(async input => String(input).startsWith('/api/coyo/tasks/rich-text-1')
    ? { ok: true, json: async () => ({ task: { ...task, comments: [], history: [] } }) }
    : { ok: true, json: async () => ({ tasks: [task] }) });

  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await waitFor(() => expect(screen.queryByText('Loading Coyô tasks…')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /AC-51 Formatted brief/ }));

  expect(screen.getByText('primary logo').tagName).toBe('STRONG');
  expect(screen.getByText('Desktop').tagName).toBe('LI');
  expect(screen.getByText('Mobile').tagName).toBe('LI');
});

it('preserves separate filters and switches Social to a calendar', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ tasks: [] }) });
  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await waitFor(() => expect(screen.queryByText('Loading Coyô tasks…')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: /^tasks$/i })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: /^dash$/i }));
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

it('defaults Tasks to creation date and Posts to post date for the last 90 days', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ tasks: [] }) });
  const first = render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await waitFor(() => expect(screen.queryByText('Loading Coyô tasks…')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: /^tasks$/i })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('checkbox', { name: 'Group by tags' })).not.toBeChecked();
  expect(screen.getByLabelText('Period')).toHaveValue('90');
  expect(screen.getByLabelText('Date type')).toHaveValue('createdAt');
  expect((global.fetch as jest.Mock).mock.calls.map(([input]) => String(input))).toEqual(expect.arrayContaining([expect.stringContaining('dateType=createdAt')]));
  expect(screen.getByLabelText('Filter by workspace')).toHaveValue('AGENCY');
  fireEvent.click(screen.getByRole('button', { name: /^dash$/i }));
  expect(screen.getByLabelText('Period')).toHaveValue('90');
  expect(screen.getByLabelText('Date type')).toHaveValue('createdAt');
  expect(screen.getByLabelText('Filter by workspace')).toHaveValue('AGENCY');
  fireEvent.click(screen.getByRole('button', { name: /^social$/i }));
  expect(screen.getByLabelText('Period')).toHaveValue('90');
  expect(screen.getByLabelText('Date type')).toHaveValue('postDate');
  await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.map(([input]) => String(input))).toEqual(expect.arrayContaining([expect.stringContaining('dateType=postDate')])));
  expect(screen.getByLabelText('Filter by workspace')).toHaveValue('AGENCY');
  fireEvent.click(screen.getByRole('button', { name: /^dash$/i }));
  fireEvent.change(screen.getByLabelText('Period'), { target: { value: '30' } });
  await waitFor(() => expect(JSON.parse(window.localStorage.getItem('coyo-tasks-dashboard-filters:v6')!).presets.dash).toBe('30'));
  first.unmount();
  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await waitFor(() => expect(screen.queryByText('Loading Coyô tasks…')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: /^tasks$/i })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: /^dash$/i }));
  expect(screen.getByLabelText('Period')).toHaveValue('30');
});

it('restores each subtabs filters, tag grouping, and Social visualization after reopening Coyô', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ tasks: [] }) });
  const first = render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await waitFor(() => expect(screen.queryByText('Loading Coyô tasks…')).not.toBeInTheDocument());

  fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'tasks query' } });
  fireEvent.change(screen.getByLabelText('Period'), { target: { value: '30' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Group by tags' }));
  fireEvent.click(screen.getByRole('button', { name: /^dash$/i }));
  fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'dash query' } });
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'FINISHED' } });
  fireEvent.click(screen.getByRole('button', { name: /^social$/i }));
  fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'social query' } });
  fireEvent.change(screen.getByLabelText('Date type'), { target: { value: 'postDate' } });
  fireEvent.click(screen.getByRole('button', { name: /^calendar$/i }));
  await waitFor(() => expect(JSON.parse(window.localStorage.getItem('coyo-tasks-dashboard-filters:v6')!).view).toBe('calendar'));
  first.unmount();

  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await waitFor(() => expect(screen.getByLabelText('Search')).toHaveValue('tasks query'));
  expect(screen.getByRole('button', { name: /^tasks$/i })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByLabelText('Period')).toHaveValue('30');
  expect(screen.getByRole('checkbox', { name: 'Group by tags' })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: /^dash$/i }));
  expect(screen.getByLabelText('Search')).toHaveValue('dash query');
  expect(screen.getByLabelText('Status')).toHaveValue('FINISHED');
  fireEvent.click(screen.getByRole('button', { name: /^social$/i }));
  expect(screen.getByLabelText('Search')).toHaveValue('social query');
  expect(screen.getByLabelText('Date type')).toHaveValue('postDate');
  expect(screen.getByRole('button', { name: /^calendar$/i })).toHaveAttribute('aria-pressed', 'true');
});

it('defaults to Agency, filters locally by workspace, and shows workspace in the task list', async () => {
  const today = new Date().toISOString();
  const base = { description: null, status: 'BACKLOG', category: 'TASK', tags: [], caption: null, driveLink: null, client: { id: '1', name: 'Acme', prefix: 'AC' }, deliveryDate: today, createdAt: today, postDate: null, executionDate: null, updatedAt: today };
  const tasks = [
    { ...base, id: 'agency', displayId: 'AC-20', title: 'Agency task', workspace: 'AGENCY' },
    { ...base, id: 'software', displayId: 'AC-21', title: 'Software task', workspace: 'SOFTWARE' },
  ];
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ tasks }) });

  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await waitFor(() => expect(screen.queryByText('Loading Coyô tasks…')).not.toBeInTheDocument());

  expect(screen.getByLabelText('Filter by workspace')).toHaveValue('AGENCY');
  expect(screen.getByRole('columnheader', { name: 'Workspace' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'AC-20 Agency task' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'AC-21 Software task' })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Filter by workspace'), { target: { value: 'SOFTWARE' } });
  expect(screen.queryByRole('button', { name: 'AC-20 Agency task' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'AC-21 Software task' })).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Filter by workspace'), { target: { value: '' } });
  expect(screen.getByRole('button', { name: 'AC-20 Agency task' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'AC-21 Software task' })).toBeInTheDocument();
});

it('keeps existing saved filters when adopting the new ungrouped default', async () => {
  const filters = { search: 'saved task', status: '', from: '', to: '', dateField: 'createdAt', tags: [] };
  window.localStorage.setItem('coyo-tasks-dashboard-filters:v3', JSON.stringify({
    filtersBySection: { dash: { ...filters, search: 'saved dash' }, tasks: filters, social: { ...filters, search: 'saved social' } },
    presets: { dash: '90', tasks: 'custom', social: '90' },
    groupTasksByTags: true,
  }));
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ tasks: [] }) });

  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await waitFor(() => expect(screen.getByLabelText('Search')).toHaveValue('saved task'));
  expect(screen.getByRole('checkbox', { name: 'Group by tags' })).not.toBeChecked();
  expect(screen.getByLabelText('Period')).toHaveValue('custom');
  fireEvent.click(screen.getByRole('button', { name: /^dash$/i }));
  expect(screen.getByLabelText('Search')).toHaveValue('saved dash');
  fireEvent.click(screen.getByRole('button', { name: /^social$/i }));
  expect(screen.getByLabelText('Search')).toHaveValue('saved social');
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
  await waitFor(() => expect(screen.queryByText('Loading Coyô tasks…')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /^tasks$/i }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Group by tags' }));
  expect(screen.getByRole('region', { name: 'Tasks tagged Design, Urgent' })).toBeInTheDocument();
  const earlier = screen.getByRole('button', { name: /AC-1 Earlier task/ });
  const later = screen.getByRole('button', { name: /AC-2 Later task/ });
  expect(later.compareDocumentPosition(earlier) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(later);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit task' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete task' })).not.toBeInTheDocument();
  expect(screen.getByTestId('coyo-detail-panel')).toHaveClass('h-dvh', 'sm:max-w-xl');
  expect(screen.getAllByText(new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(today))).length).toBeGreaterThan(0);
  expect(screen.getByRole('link', { name: 'Open in Google Drive' })).toHaveAttribute('href', 'https://drive.google.com/drive/folders/folder_1');
  expect(await screen.findByRole('link', { name: 'Open 01.jpg' })).toHaveAttribute('href', '/api/coyo/files/preview?mainAccountId=customer&taskId=later&fileId=image_1');
  expect(await screen.findByRole('button', { name: 'Next Drive file' })).toBeInTheDocument();
  expect(await screen.findByRole('img', { name: '01.jpg' })).toHaveAttribute('src', '/api/coyo/files/preview?mainAccountId=customer&taskId=later&fileId=image_1');
  fireEvent.click(screen.getByRole('button', { name: 'Next Drive file' }));
  expect(await screen.findByRole('img', { name: '02.jpg' })).toBeInTheDocument();
});

it('shows edit and delete actions only for Backlog tasks and updates in place', async () => {
  const today = new Date().toISOString();
  const backlog = { id: 'backlog-edit', displayId: 'AC-60', title: 'Original title', description: '<p>Original description</p>', status: 'BACKLOG', category: 'TASK', workspace: 'AGENCY', tags: [], caption: null, driveLink: null, client: { id: '1', name: 'Acme', prefix: 'AC' }, deliveryDate: today, createdAt: today, postDate: null, executionDate: null, updatedAt: today };
  (global.fetch as jest.Mock).mockImplementation(async (_input, init) => init?.method === 'PATCH'
    ? { ok: true, json: async () => ({ task: { ...backlog, title: 'Updated title' } }) }
    : { ok: true, json: async () => ({ tasks: [backlog] }) });

  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await waitFor(() => expect(screen.queryByText('Loading Coyô tasks…')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /^tasks$/i }));
  fireEvent.click(screen.getByRole('button', { name: /AC-60 Original title/ }));
  expect(screen.getByRole('button', { name: 'Edit task' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Delete task' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Edit task' }));
  fireEvent.change(screen.getByLabelText('Edit title'), { target: { value: 'Updated title' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true));
  const patchCall = (global.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'PATCH');
  expect(patchCall?.[0]).toBe('/api/coyo/tasks/backlog-edit');
  expect(Object.fromEntries((patchCall?.[1].body as FormData).entries())).toEqual(expect.objectContaining({ mainAccountId: 'customer', title: 'Updated title', description: 'Original description', workspace: 'AGENCY' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('adds Backlog attachments from the edit panel', async () => {
  const today = new Date().toISOString();
  const backlog = { id: 'backlog-files', displayId: 'AC-62', title: 'Files task', description: '<p>Copy</p><img src="/api/drive/media?fileId=image_1">', status: 'BACKLOG', category: 'TASK', workspace: 'AGENCY', tags: [], caption: null, driveLink: null, client: { id: '1', name: 'Acme', prefix: 'AC' }, deliveryDate: today, createdAt: today, postDate: null, executionDate: null, updatedAt: today };
  (global.fetch as jest.Mock).mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method === 'PATCH') return { ok: true, json: async () => ({ task: backlog }) };
    if (init?.method === 'DELETE') return { ok: true, json: async () => ({ task: { ...backlog, description: '<p>Copy</p>' } }) };
    if (url.startsWith('/api/coyo/files?')) return { ok: true, json: async () => ({ isFolder: false, name: 'Artwork.png', files: [{ id: 'image_1', name: 'Artwork.png', mimeType: 'image/png' }] }) };
    if (url.startsWith('/api/coyo/files/preview?')) return { ok: true, blob: async () => new Blob(['artwork']) };
    return { ok: true, json: async () => ({ tasks: [backlog] }) };
  });

  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await waitFor(() => expect(screen.queryByText('Loading Coyô tasks…')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /^tasks$/i }));
  fireEvent.click(screen.getByRole('button', { name: /AC-62 Files task/ }));
  await screen.findByRole('button', { name: 'Preview Artwork.png' });
  fireEvent.click(screen.getByRole('button', { name: 'Edit task' }));

  const added = new File(['brief'], 'brief.pdf', { type: 'application/pdf' });
  const removed = new File(['draft'], 'draft.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Add attachments'), { target: { files: [added, removed] } });
  expect(screen.getByText('brief.pdf')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Remove selected draft.png' }));
  expect(screen.queryByText('draft.png')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true));
  const patchBody = (global.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'PATCH')?.[1].body as FormData;
  expect([...patchBody.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : value.name])).toContainEqual(['attachments', 'brief.pdf']);
});

it('requires confirmation before removing one Backlog attachment', async () => {
  const today = new Date().toISOString();
  const backlog = { id: 'backlog-files', displayId: 'AC-62', title: 'Files task', description: '<p>Copy</p><img src="/api/drive/media?fileId=image_1">', status: 'BACKLOG', category: 'TASK', workspace: 'AGENCY', tags: [], caption: null, driveLink: null, client: { id: '1', name: 'Acme', prefix: 'AC' }, deliveryDate: today, createdAt: today, postDate: null, executionDate: null, updatedAt: today };
  (global.fetch as jest.Mock).mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method === 'DELETE') return { ok: true, json: async () => ({ task: { ...backlog, description: '<p>Copy</p>' } }) };
    if (url.startsWith('/api/coyo/files?')) return { ok: true, json: async () => ({ isFolder: false, name: 'Artwork.png', files: [{ id: 'image_1', name: 'Artwork.png', mimeType: 'image/png' }] }) };
    if (url.startsWith('/api/coyo/files/preview?')) return { ok: true, blob: async () => new Blob(['artwork']) };
    return { ok: true, json: async () => ({ tasks: [backlog] }) };
  });

  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await waitFor(() => expect(screen.queryByText('Loading Coyô tasks…')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /^tasks$/i }));
  fireEvent.click(screen.getByRole('button', { name: /AC-62 Files task/ }));
  await screen.findByRole('button', { name: 'Preview Artwork.png' });
  fireEvent.click(screen.getByRole('button', { name: 'Edit task' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove Artwork.png' }));
  expect(screen.getByText(/move it to Drive trash/)).toBeInTheDocument();
  expect((global.fetch as jest.Mock).mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
  await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true));
  const deleteUrl = (global.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'DELETE')?.[0];
  expect(deleteUrl).toBe('/api/coyo/tasks/backlog-files/attachments/image_1?mainAccountId=customer');
});

it('requires explicit confirmation before deleting a Backlog task', async () => {
  const today = new Date().toISOString();
  const backlog = { id: 'backlog-delete', displayId: 'AC-61', title: 'Delete me', description: null, status: 'BACKLOG', category: 'TASK', workspace: 'AGENCY', tags: [], caption: null, driveLink: null, client: { id: '1', name: 'Acme', prefix: 'AC' }, deliveryDate: today, createdAt: today, postDate: null, executionDate: null, updatedAt: today };
  (global.fetch as jest.Mock).mockImplementation(async (_input, init) => init?.method === 'DELETE'
    ? { ok: true, status: 204 }
    : { ok: true, json: async () => ({ tasks: [backlog] }) });

  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await waitFor(() => expect(screen.queryByText('Loading Coyô tasks…')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /^tasks$/i }));
  fireEvent.click(screen.getByRole('button', { name: /AC-61 Delete me/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete task' }));
  expect(screen.getByRole('region', { name: 'Confirm task deletion' })).toHaveTextContent('This cannot be undone');
  expect((global.fetch as jest.Mock).mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);

  fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
  await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true));
  const deleteCall = (global.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'DELETE');
  expect(deleteCall?.[0]).toBe('/api/coyo/tasks/backlog-delete?mainAccountId=customer');
});

it('filters tasks by multiple tags and can enable tag grouping', async () => {
  const today = new Date().toISOString();
  const base = { description: null, status: 'BACKLOG', category: 'TASK', workspace: 'AGENCY', caption: null, driveLink: null, client: { id: '1', name: 'Acme', prefix: 'AC' }, deliveryDate: today, createdAt: today, postDate: null, executionDate: null, updatedAt: today };
  const tasks = [
    { ...base, id: 'design', displayId: 'AC-10', title: 'Design task', tags: ['Design'] },
    { ...base, id: 'copy', displayId: 'AC-11', title: 'Copy task', tags: ['Copy'] },
    { ...base, id: 'both', displayId: 'AC-12', title: 'Combined task', tags: ['Design', 'Copy'] },
  ];
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ tasks }) });

  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await waitFor(() => expect(screen.queryByText('Loading Coyô tasks…')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /^tasks$/i }));

  expect(screen.getByRole('checkbox', { name: 'Group by tags' })).not.toBeChecked();
  fireEvent.click(screen.getByLabelText('Tag filters'));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Filter by tag Design' }));
  expect(screen.getByRole('button', { name: 'AC-10 Design task' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'AC-12 Combined task' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'AC-11 Copy task' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('checkbox', { name: 'Filter by tag Copy' }));
  expect(screen.getByRole('button', { name: 'AC-11 Copy task' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Group by tags' }));
  expect(screen.getByRole('region', { name: 'Tasks tagged Design' })).toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'Tags' })).not.toBeInTheDocument();
});

it('renders social details as a phone-proportioned post in the side panel', async () => {
  const today = new Date().toISOString();
  const post = { id: 'post-1', displayId: 'AC-3', title: 'Launch post', description: 'Post description', status: 'IN_REVIEW', category: 'POST', postFormat: ['Post', 'Story'], workspace: 'AGENCY', tags: ['Instagram'], caption: 'A launch caption', driveLink: 'https://drive.google.com/drive/folders/folder_1', client: { id: '1', name: 'Acme', prefix: 'AC' }, deliveryDate: today, createdAt: today, postDate: today, executionDate: null, updatedAt: today };
  (global.fetch as jest.Mock).mockImplementation(async input => String(input).startsWith('/api/coyo/files?')
    ? { ok: true, json: async () => ({ isFolder: true, name: 'Campaign', files: [{ id: 'image_1', name: 'post.jpg', mimeType: 'image/jpeg' }, { id: 'story_1', name: 'story.mp4', mimeType: 'video/mp4' }], formats: [{ format: 'Post', files: [{ id: 'image_1', name: 'post.jpg', mimeType: 'image/jpeg' }] }, { format: 'Story', files: [{ id: 'story_1', name: 'story.mp4', mimeType: 'video/mp4' }] }] }) }
    : { ok: true, json: async () => ({ tasks: [post] }) });

  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await waitFor(() => expect(screen.queryByText('Loading Coyô tasks…')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /^social$/i }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByText('Loading Coyô tasks…')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /AC-3 Launch post/ }));

  expect(await screen.findByTestId('social-post-preview')).toHaveClass('aspect-[9/19.5]');
  expect(screen.getByText('Post preview')).toBeInTheDocument();
  expect(screen.getAllByText('A launch caption')).toHaveLength(2);
  expect(await screen.findByRole('img', { name: 'post.jpg' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open in Google Drive' })).toHaveAttribute('href', 'https://drive.google.com/drive/folders/folder_1');
  fireEvent.click(screen.getByRole('button', { name: 'Story' }));
  expect(screen.getByTestId('story-preview')).toHaveClass('aspect-[9/19.5]');
  expect(screen.getByText('Send message')).toBeInTheDocument();
  expect(screen.getByTitle('Drive preview: story.mp4')).toHaveClass('object-cover');
});

it('shows post types, emphasizes post dates, and makes the whole post row clickable', async () => {
  const today = new Date().toISOString();
  const post = { id: 'post-table', displayId: 'AC-5', title: 'Social table post', description: null, status: 'CREATED', category: 'POST', postFormat: ['Post', 'Story'], workspace: 'AGENCY', tags: [], caption: null, driveLink: null, client: { id: '1', name: 'Acme', prefix: 'AC' }, deliveryDate: today, createdAt: today, postDate: today, executionDate: today, updatedAt: today };
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ tasks: [post] }) });

  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await waitFor(() => expect(screen.queryByText('Loading Coyô tasks…')).not.toBeInTheDocument());
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
  await waitFor(() => expect(screen.queryByText('Loading Coyô tasks…')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /^tasks$/i }));
  fireEvent.click(screen.getByRole('button', { name: /AC-4 Cached artwork/ }));

  await waitFor(() => expect(createObjectUrl).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('img', { name: '01.jpg' }).getAttribute('src')).toMatch(/^blob:preview-/);
  fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
  expect(revokeObjectUrl).toHaveBeenCalledTimes(2);
});

it('loads comments and history in task details and adds a new comment', async () => {
  const today = new Date().toISOString();
  const task = { id: 'activity-1', displayId: 'AC-70', title: 'Review campaign', description: 'Review the final assets.', status: 'IN_REVIEW', category: 'TASK', workspace: 'AGENCY', tags: [], caption: null, driveLink: null, client: { id: '1', name: 'Acme', prefix: 'AC' }, deliveryDate: today, createdAt: today, postDate: null, executionDate: null, updatedAt: today };
  const detail = {
    ...task,
    comments: [{ id: 'comment-1', content: '<p>Can we make the <strong>logo larger</strong>?</p>', author: { id: 'user-1', name: 'Ana' }, createdAt: '2026-09-15T12:00:00Z' }],
    history: [{ id: 'history-1', action: 'changed status', oldValue: 'BACKLOG', newValue: 'IN_REVIEW', author: { id: 'user-2', name: 'Bruno' }, createdAt: '2026-09-16T12:00:00Z' }],
  };
  const created = { id: 'comment-2', content: '<p>Updated and ready.</p>', author: { id: 'user-3', name: 'Carla' }, createdAt: '2026-09-16T13:00:00Z' };
  (global.fetch as jest.Mock).mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === '/api/coyo/tasks/activity-1?mainAccountId=customer') return { ok: true, json: async () => ({ task: detail }) };
    if (url === '/api/coyo/tasks/activity-1' && init?.method === 'PATCH') return { ok: true, status: 201, json: async () => ({ comment: created }) };
    return { ok: true, json: async () => ({ tasks: [task] }) };
  });

  render(<CoyoTasksDashboardView selectedAccountId="customer" />);
  await waitFor(() => expect(screen.queryByText('Loading Coyô tasks…')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /^tasks$/i }));
  fireEvent.click(screen.getByRole('button', { name: /AC-70 Review campaign/ }));

  expect(await screen.findByText('logo larger')).toHaveProperty('tagName', 'STRONG');
  expect(screen.getByText('changed status')).toBeInTheDocument();
  expect(screen.getByText('BACKLOG')).toHaveClass('line-through');
  fireEvent.change(screen.getByLabelText('Add a comment'), { target: { value: ' Updated and ready. ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));

  expect(await screen.findByText('Updated and ready.')).toBeInTheDocument();
  expect(await screen.findByText('Carla')).toBeInTheDocument();
  expect(screen.getByText('Updated and ready.').compareDocumentPosition(screen.getByText('logo larger')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByLabelText('Add a comment')).toHaveValue('');
  const commentCall = (global.fetch as jest.Mock).mock.calls.find(([input, init]) => String(input) === '/api/coyo/tasks/activity-1' && init?.method === 'PATCH');
  expect(JSON.parse(commentCall?.[1].body)).toEqual({ mainAccountId: 'customer', comment: 'Updated and ready.' });
});
