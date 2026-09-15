export const statuses = ['BACKLOG', 'CREATED', 'IN_PROGRESS', 'IN_REVIEW', 'SENT', 'CHANGES_REQUESTED', 'APPROVED', 'FINISHED'] as const;
export const dateFields = { deliveryDate: 'Delivery date', createdAt: 'Creation date', postDate: 'Post date', executionDate: 'Execution date', updatedAt: 'Updated date' };
export type DateField = keyof typeof dateFields;
export type CoyoTag = string | { id?: string; name: string; color?: string | null };
export type CoyoTask = {
  id: string; displayId: string; title: string; description: string | null; status: string; category: string;
  workspace: string; tags?: CoyoTag[]; caption: string | null; driveLink: string | null; postFormat?: string | string[] | null;
  client: { id: string; name: string; prefix: string };
  deliveryDate: string | null; createdAt: string; postDate: string | null; executionDate: string | null; updatedAt: string;
};
export type CoyoPostFormat = 'Post' | 'Story' | 'Reels' | 'Carousel';
export type TaskFilters = { search: string; status: string; from: string; to: string; dateField: DateField; tags?: string[] };
export function filterTasks(tasks: CoyoTask[], filters: TaskFilters, section: string) {
  return tasks.filter(task => {
    if (section === 'tasks' && task.category !== 'TASK') return false;
    if (section === 'social' && task.category === 'TASK') return false;
    const date = task[filters.dateField]?.slice(0, 10);
    const selectedTags = filters.tags || [];
    const taskTags = new Set((task.tags || []).map(tagName).map(name => name.toLocaleLowerCase('pt-BR')));
    return (!filters.status || task.status === filters.status)
      && (!filters.from || (!!date && date >= filters.from))
      && (!filters.to || (!!date && date <= filters.to))
      && (!selectedTags.length || selectedTags.some(tag => taskTags.has(tag.toLocaleLowerCase('pt-BR'))))
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

function trustedCoyoAttachmentLink(value: string) {
  const link = safeLink(value);
  if (!link) return null;
  const url = new URL(link);
  const fileId = url.searchParams.get('fileId');
  return url.hostname === 'taskmanager.coyo.com.br' && url.pathname === '/api/drive/media' && fileId && /^[A-Za-z0-9_-]{1,200}$/.test(fileId) ? link : null;
}

const attachmentNodePattern = /<a\b[^>]*\bhref\s*=\s*["'][^"']*\/api\/drive\/media\?[^"']*["'][^>]*>[\s\S]*?<\/a>|<img\b[^>]*\bsrc\s*=\s*["'][^"']*\/api\/drive\/media\?[^"']*["'][^>]*\/?\s*>/gi;

export function coyoAttachmentMarkup(description: string | null | undefined) {
  if (!description) return '';
  return [...description.matchAll(attachmentNodePattern)].flatMap(match => {
    const attribute = match[0].match(/(?:href|src)\s*=\s*["']([^"']+)["']/i)?.[1];
    return attribute && trustedCoyoAttachmentLink(attribute) ? [match[0]] : [];
  }).join('\n');
}

export function removeCoyoAttachmentMarkup(description: string | null | undefined, fileId: string) {
  if (!description) return '';
  return description.replace(attachmentNodePattern, node => {
    const attribute = node.match(/(?:href|src)\s*=\s*["']([^"']+)["']/i)?.[1];
    return attribute && extractGoogleDriveFileId(attribute) === fileId ? '' : node;
  }).replace(/<li>\s*<\/li>/gi, '').replace(/<(?:ul|ol)>\s*<\/(?:ul|ol)>/gi, '').trim();
}

export function taskTextDescription(description: string | null | undefined) {
  return (description || '').replace(attachmentNodePattern, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizePostFormats(value: CoyoTask['postFormat'], category = ''): CoyoPostFormat[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,;|]/) : [];
  if (!values.length && category && category !== 'TASK') values.push(category);
  const formats = values.flatMap(raw => {
    const normalized = raw.trim().toUpperCase();
    if (normalized.includes('STOR')) return ['Story' as const];
    if (normalized.includes('REEL')) return ['Reels' as const];
    if (normalized.includes('CAROUSEL') || normalized.includes('CARROSSEL')) return ['Carousel' as const];
    if (normalized.includes('POST')) return ['Post' as const];
    return [];
  });
  return [...new Set(formats)];
}

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
  return taskAttachmentLinks(task)[0] || null;
}

export function taskAttachmentLinks(task: CoyoTask) {
  const direct = safeLink(task.driveLink);
  const links = direct ? [direct] : [];
  if (task.status !== 'BACKLOG' || !task.description) return links;
  const attributes = task.description.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi);
  for (const match of attributes) {
    const link = trustedCoyoAttachmentLink(match[1]);
    if (!link) continue;
    links.push(link);
  }
  return [...new Set(links)];
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
