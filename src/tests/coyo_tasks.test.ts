import { CoyoTask, filterTasks, formatBrazilianDate, groupTasksByExactTags, safeLink, TaskFilters } from '@/lib/coyoTasks';
const filters: TaskFilters = { search: '', status: '', from: '', to: '', dateField: 'postDate' };
const task = { id: '1', title: 'Campaign', displayId: 'AC-1', category: 'TASK', status: 'BACKLOG', createdAt: '2026-08-01', deliveryDate: '2026-09-01', postDate: null } as CoyoTask;
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
it('rejects executable links and resolves relative resources', () => {
  expect(safeLink('javascript:alert(1)')).toBeNull();
  expect(safeLink('/api/drive/media?fileId=1')).toBe('https://taskmanager.coyo.com.br/api/drive/media?fileId=1');
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

it('orders task rows by delivery and then creation date', () => {
  const laterCreated = { ...task, id: 'later', deliveryDate: '2026-09-01', createdAt: '2026-08-03' };
  const earlierCreated = { ...task, id: 'earlier', deliveryDate: '2026-09-01', createdAt: '2026-08-02' };
  const laterDelivery = { ...task, id: 'delivery', deliveryDate: '2026-09-02', createdAt: '2026-08-01' };
  expect(filterTasks([laterCreated, laterDelivery, earlierCreated], { ...filters, from: '', to: '' }, 'tasks').map(item => item.id)).toEqual(['earlier', 'later', 'delivery']);
});
