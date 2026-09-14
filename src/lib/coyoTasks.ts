export const statuses = ['BACKLOG', 'CREATED', 'IN_PROGRESS', 'IN_REVIEW', 'SENT', 'CHANGES_REQUESTED', 'APPROVED', 'FINISHED'] as const;
export const dateFields = { deliveryDate: 'Delivery date', createdAt: 'Creation date', postDate: 'Post date', executionDate: 'Execution date', updatedAt: 'Updated date' };
export type DateField = keyof typeof dateFields;
export type CoyoTag = string | { id?: string; name: string; color?: string | null };
export type CoyoTask = {
  id: string; displayId: string; title: string; description: string | null; status: string; category: string;
  workspace: string; tags?: CoyoTag[]; caption: string | null; driveLink: string | null;
  client: { id: string; name: string; prefix: string };
  deliveryDate: string | null; createdAt: string; postDate: string | null; executionDate: string | null; updatedAt: string;
};
export type TaskFilters = { search: string; status: string; from: string; to: string; dateField: DateField };
export function filterTasks(tasks: CoyoTask[], filters: TaskFilters, section: string) {
  return tasks.filter(task => {
    if (section === 'tasks' && task.category !== 'TASK') return false;
    if (section === 'social' && task.category === 'TASK') return false;
    const date = task[filters.dateField]?.slice(0, 10);
    return (!filters.status || task.status === filters.status)
      && (!filters.from || (!!date && date >= filters.from))
      && (!filters.to || (!!date && date <= filters.to))
      && `${task.displayId} ${task.title} ${task.caption || ''}`.toLowerCase().includes(filters.search.toLowerCase());
  }).sort((a, b) => section === 'tasks'
    ? compareDate(a.deliveryDate, b.deliveryDate) || compareDate(a.createdAt, b.createdAt)
    : compareDate(a[filters.dateField], b[filters.dateField]));
}
function compareDate(a: string | null | undefined, b: string | null | undefined) {
  return (a || '9999').localeCompare(b || '9999');
}
export function safeLink(value: string | null) {
  if (!value) return null;
  try { const url = new URL(value, 'https://taskmanager.coyo.com.br'); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function statusLabel(value: string) { return value.toLowerCase().replaceAll('_', ' '); }

export function tagName(tag: CoyoTag) { return typeof tag === 'string' ? tag : tag.name; }

export function exactTagKey(task: CoyoTask) {
  const names = (task.tags || []).map(tagName).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return names.length ? names.join('\u0000') : '__untagged__';
}

export function groupTasksByExactTags(tasks: CoyoTask[]) {
  const groups = new Map<string, CoyoTask[]>();
  tasks.forEach(task => {
    const key = exactTagKey(task);
    groups.set(key, [...(groups.get(key) || []), task]);
  });
  return [...groups.entries()].map(([key, items]) => ({
    key,
    tags: key === '__untagged__' ? [] : (items[0].tags || []).map(tagName).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    tasks: items,
  }));
}

export function formatBrazilianDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
}

export function firstAttachmentLink(task: CoyoTask) {
  return safeLink(task.driveLink);
}

export function taskAttachmentLinks(task: CoyoTask) {
  const direct = safeLink(task.driveLink);
  return direct ? [direct] : [];
}

export function extractGoogleDriveFileId(value: string) {
  try {
    const url = new URL(value, 'https://taskmanager.coyo.com.br');
    let fileId: string | null = null;
    if (url.hostname === 'taskmanager.coyo.com.br' && url.pathname === '/api/drive/media') fileId = url.searchParams.get('fileId');
    if (url.hostname === 'drive.google.com') fileId = url.searchParams.get('id') || url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.pathname.match(/\/folders\/([^/]+)/)?.[1] || null;
    if (url.hostname === 'docs.google.com') fileId = url.pathname.match(/\/(?:document|spreadsheets|presentation|drawings)\/d\/([^/]+)/)?.[1] || null;
    return fileId && /^[A-Za-z0-9_-]{1,200}$/.test(fileId) ? fileId : null;
  } catch { return null; }
}
