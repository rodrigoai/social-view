import { CoyoTask, filterTasks, formatBrazilianDate, groupTasksByExactTags, normalizePostFormats, removeCoyoAttachmentMarkup, safeLink, taskAttachmentLinks, taskRichTextDescription, TaskFilters } from '@/lib/coyoTasks';
const filters: TaskFilters = { search: '', status: '', workspace: 'AGENCY', from: '', to: '', dateField: 'postDate' };
const task = { id: '1', title: 'Campaign', displayId: 'AC-1', category: 'TASK', status: 'BACKLOG', workspace: 'AGENCY', createdAt: '2026-08-01', deliveryDate: '2026-09-01', postDate: null } as CoyoTask;
const post = { ...task, id: '2', category: 'POST', postDate: '2026-09-10T23:59:00Z' };
it('keeps posts out of Tasks and tasks out of Social', () => {
  expect(filterTasks([task, post], filters, 'tasks')).toEqual([task]);
  expect(filterTasks([task, post], filters, 'social')).toEqual([post]);
  expect(filterTasks([task, post], filters, 'dash')).toHaveLength(2);
});
it('filters inclusively using the selected date rather than delivery date', () => {
  expect(filterTasks([task, post], { ...filters, from: '2026-09-10', to: '2026-09-10' }, 'social')).toEqual([post]);
  expect(filterTasks([post], { ...filters, dateField: 'createdAt', from: '2026-09-10' }, 'social')).toEqual([]);
});
it('combines search and status and retains undated items with no date bounds', () => {
  expect(filterTasks([task], { ...filters, search: 'ac-1', status: 'BACKLOG' }, 'tasks')).toEqual([task]);
  expect(filterTasks([task], { ...filters, status: 'FINISHED' }, 'tasks')).toEqual([]);
});
it('filters by workspace and treats an empty workspace filter as both', () => {
  const software = { ...task, id: 'software', workspace: 'SOFTWARE' };
  expect(filterTasks([task, software], filters, 'tasks')).toEqual([task]);
  expect(filterTasks([task, software], { ...filters, workspace: 'SOFTWARE' }, 'tasks')).toEqual([software]);
  expect(filterTasks([task, software], { ...filters, workspace: '' }, 'tasks')).toEqual([task, software]);
});
it('matches any of multiple selected tags without case sensitivity', () => {
  const design = { ...task, id: 'design', tags: ['Design'] };
  const copy = { ...task, id: 'copy', tags: [{ name: 'COPY' }] };
  const untagged = { ...task, id: 'untagged', tags: [] };
  expect(filterTasks([design, copy, untagged], { ...filters, tags: ['design', 'Copy'] }, 'tasks')).toEqual([design, copy]);
});
it('rejects executable links and resolves relative resources', () => {
  expect(safeLink('javascript:alert(1)')).toBeNull();
  expect(safeLink('/api/drive/media?fileId=1')).toBe('https://taskmanager.coyo.com.br/api/drive/media?fileId=1');
});
it('extracts only trusted attachment links from Backlog descriptions', () => {
  const backlog = { ...task, description: '<img src="/api/drive/media?fileId=image_1"><a href="https://taskmanager.coyo.com.br/api/drive/media?fileId=brief_2">Brief</a><a href="https://evil.example/file">Bad</a>' };
  expect(taskAttachmentLinks(backlog)).toEqual([
    'https://taskmanager.coyo.com.br/api/drive/media?fileId=image_1',
    'https://taskmanager.coyo.com.br/api/drive/media?fileId=brief_2',
  ]);
  expect(taskAttachmentLinks({ ...backlog, status: 'IN_PROGRESS' })).toEqual([]);
});
it('removes only the selected attachment markup from a description', () => {
  const description = '<p>Brief</p><img src="/api/drive/media?fileId=image_1" alt="First"><a href="/api/drive/media?fileId=brief_2">Second</a>';
  expect(removeCoyoAttachmentMarkup(description, 'image_1')).toBe('<p>Brief</p><a href="/api/drive/media?fileId=brief_2">Second</a>');
  expect(removeCoyoAttachmentMarkup(description, 'missing')).toBe(description);
});
it('preserves rich text while excluding attachment markup from the task description', () => {
  const description = '<p>A <strong>formatted</strong> brief.</p><ul><li>First item</li></ul><img src="/api/drive/media?fileId=image_1">';
  expect(taskRichTextDescription(description)).toBe('<p>A <strong>formatted</strong> brief.</p><ul><li>First item</li></ul>');
});
it('normalizes single and multi-value post formats', () => {
  expect(normalizePostFormats('Story', 'POST')).toEqual(['Story']);
  expect(normalizePostFormats(['Post', 'REELS', 'Carrossel'], 'POST')).toEqual(['Post', 'Reels', 'Carousel']);
  expect(normalizePostFormats(null, 'STORY')).toEqual(['Story']);
});
it('formats dates for Brazil and groups only identical tag sets', () => {
  expect(formatBrazilianDate('2026-09-10T23:59:00Z')).toBe('10/09/2026');
  const groups = groupTasksByExactTags([
    { ...task, id: 'a', tags: ['Urgent', 'Design'] },
    { ...task, id: 'b', tags: ['Design', 'Urgent'] },
    { ...task, id: 'c', tags: ['Design'] },
  ]);
  expect(groups.map(group => group.tasks.map(item => item.id))).toEqual([['a', 'b'], ['c']]);
});

it('orders task rows by creation date descending', () => {
  const laterCreated = { ...task, id: 'later', deliveryDate: '2026-09-01', createdAt: '2026-08-03' };
  const earlierCreated = { ...task, id: 'earlier', deliveryDate: '2026-09-01', createdAt: '2026-08-02' };
  const laterDelivery = { ...task, id: 'delivery', deliveryDate: '2026-09-02', createdAt: '2026-08-01' };
  expect(filterTasks([earlierCreated, laterDelivery, laterCreated], { ...filters, from: '', to: '', dateField: 'createdAt' }, 'tasks').map(item => item.id)).toEqual(['later', 'earlier', 'delivery']);
});
