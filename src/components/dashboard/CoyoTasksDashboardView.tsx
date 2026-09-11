'use client';

import { useEffect, useMemo, useState } from 'react';
import { CoyoTask, DateField, TaskFilters, dateFields, filterTasks, firstAttachmentLink, formatBrazilianDate, groupTasksByExactTags, safeLink, statuses, statusLabel, tagName } from '@/lib/coyoTasks';

type Section = 'dash' | 'tasks' | 'social';
type RangePreset = '7' | '30' | '60' | '90' | 'custom';
type FiltersState = Record<Section, TaskFilters>;
type PresetsState = Record<Section, RangePreset>;

const STORAGE_KEY = 'coyo-tasks-dashboard-filters:v2';
const control = 'rounded-xl border border-border-custom bg-card px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15';
const statusStyles: Record<string, string> = {
  BACKLOG: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  CREATED: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  IN_REVIEW: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  SENT: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
  CHANGES_REQUESTED: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  FINISHED: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
};

function inputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function presetDates(days: number) {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days + 1);
  return { from: inputDate(from), to: inputDate(to) };
}

function defaultFilters(): FiltersState {
  const dates = presetDates(7);
  const base = { search: '', status: '', ...dates };
  return { dash: { ...base, dateField: 'deliveryDate' }, tasks: { ...base, dateField: 'deliveryDate' }, social: { ...base, dateField: 'postDate' } };
}

function StatusTag({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize leading-none ${statusStyles[status] || statusStyles.BACKLOG}`}>{statusLabel(status)}</span>;
}

function TagList({ task }: { task: CoyoTask }) {
  if (!task.tags?.length) return <span className="text-muted">No tags</span>;
  return <span className="inline-flex flex-wrap gap-1.5">{task.tags.map((tag, index) => <span key={`${tagName(tag)}-${index}`} className="rounded-md bg-accent-custom px-2 py-1 text-xs font-medium">{tagName(tag)}</span>)}</span>;
}

function weekStart(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  const distance = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - distance);
  return date.toISOString().slice(0, 10);
}

function WeeklyChart({ tasks, filters }: { tasks: CoyoTask[]; filters: TaskFilters }) {
  const series = useMemo(() => {
    const dated = tasks.map(task => task[filters.dateField]?.slice(0, 10)).filter((date): date is string => Boolean(date));
    const sorted = [...dated].sort();
    const from = filters.from || sorted[0] || inputDate(new Date());
    const to = filters.to || sorted.at(-1) || from;
    const first = new Date(`${weekStart(from)}T00:00:00Z`);
    const last = new Date(`${weekStart(to)}T00:00:00Z`);
    const weeks: { date: string; count: number }[] = [];
    for (let cursor = new Date(first); cursor <= last && weeks.length < 520; cursor.setUTCDate(cursor.getUTCDate() + 7)) {
      const date = cursor.toISOString().slice(0, 10);
      weeks.push({ date, count: dated.filter(itemDate => weekStart(itemDate) === date).length });
    }
    return weeks;
  }, [tasks, filters.dateField, filters.from, filters.to]);
  const width = 800, height = 250;
  const pad = { left: 44, right: 20, top: 20, bottom: 44 };
  const max = Math.max(1, ...series.map(item => item.count));
  const x = (index: number) => pad.left + (series.length === 1 ? (width - pad.left - pad.right) / 2 : index * (width - pad.left - pad.right) / (series.length - 1));
  const y = (count: number) => pad.top + (max - count) * (height - pad.top - pad.bottom) / max;
  const points = series.map((item, index) => `${x(index)},${y(item.count)}`).join(' ');
  const area = series.length ? `M ${x(0)} ${height - pad.bottom} L ${series.map((item, index) => `${x(index)} ${y(item.count)}`).join(' L ')} L ${x(series.length - 1)} ${height - pad.bottom} Z` : '';
  const labelEvery = Math.max(1, Math.ceil(series.length / 7));
  const peak = series.every(item => item.count === 0) ? 0 : max;

  return <div className="border-b border-border-custom pb-7">
    <div className="mb-4 flex items-end justify-between gap-4"><div><h3 className="font-semibold">Items per week</h3><p className="mt-1 text-sm text-muted">All task and social formats, based on {dateFields[filters.dateField].toLowerCase()}.</p></div><span className="text-sm tabular-nums text-muted">Peak <strong className="text-foreground">{peak}</strong></span></div>
    <div className="overflow-x-auto rounded-2xl bg-accent-custom/70 px-2 py-3"><svg viewBox={`0 0 ${width} ${height}`} className="h-64 min-w-[640px] w-full" role="img" aria-label="Items per week line chart">
      {[0, Math.ceil(max / 2), max].filter((tick, index, values) => values.indexOf(tick) === index).map(tick => <g key={tick}><line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="currentColor" className="text-border-custom" /><text x={pad.left - 10} y={y(tick) + 4} textAnchor="end" className="fill-muted text-[11px]">{tick}</text></g>)}
      <defs><linearGradient id="coyo-chart-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#10b981" stopOpacity=".28" /><stop offset="1" stopColor="#10b981" stopOpacity=".02" /></linearGradient></defs>
      <path d={area} fill="url(#coyo-chart-area)" className="coyo-chart-area" /><polyline points={points} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className="coyo-trend-line" />
      {series.map((item, index) => <g key={item.date}><circle cx={x(index)} cy={y(item.count)} r="4" fill="#059669"><title>{formatBrazilianDate(item.date)}: {item.count} items</title></circle>{(index % labelEvery === 0 || index === series.length - 1) && <text x={x(index)} y={height - 17} textAnchor="middle" className="fill-muted text-[10px]">{formatBrazilianDate(item.date).slice(0, 5)}</text>}</g>)}
    </svg></div>
  </div>;
}

function socialFormat(category: string) {
  const value = category.toUpperCase();
  if (value.includes('REEL')) return 'Reel';
  if (value.includes('STOR')) return 'Story';
  if (value.includes('CAROUSEL') || value.includes('CARROSSEL')) return 'Carousel';
  return 'Post';
}

function InstagramPreview({ task }: { task: CoyoTask }) {
  const format = socialFormat(task.category);
  const vertical = format === 'Reel' || format === 'Story';
  const mediaLink = firstAttachmentLink(task);
  const imageLink = mediaLink && /\.(avif|gif|jpe?g|png|webp)(?:\?|$)/i.test(mediaLink) ? mediaLink : null;
  return <div className={`mx-auto overflow-hidden bg-white text-slate-950 shadow-2xl ring-1 ring-black/10 ${vertical ? 'max-w-[280px] rounded-[2rem]' : 'max-w-[390px] rounded-2xl'}`}>
    <div className="flex items-center gap-2.5 px-4 py-3"><div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 text-xs font-black text-white">C</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{task.client?.name || 'Coyô'}</p><p className="text-[10px] text-slate-500">{format}</p></div><span className="font-bold">•••</span></div>
    <div className={`relative grid place-items-center overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-600 to-lime-300 ${vertical ? 'aspect-[9/16]' : 'aspect-square'}`} style={imageLink ? { backgroundImage: `linear-gradient(rgba(0,0,0,.08),rgba(0,0,0,.08)), url("${imageLink.replaceAll('"', '%22')}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
      {!imageLink && <div className="max-w-[82%] text-center text-white"><p className="text-xs font-semibold uppercase tracking-[.24em] opacity-75">{task.displayId}</p><p className={`${vertical ? 'mt-5 text-2xl' : 'mt-4 text-3xl'} font-black leading-tight`}>{task.title}</p></div>}
      {format === 'Reel' && <span className="absolute inset-0 grid place-items-center"><span className="grid h-14 w-14 place-items-center rounded-full bg-black/35 text-2xl text-white backdrop-blur">▶</span></span>}
      {format === 'Story' && <div className="absolute inset-x-3 top-3 flex gap-1"><span className="h-0.5 flex-1 rounded bg-white" /><span className="h-0.5 flex-1 rounded bg-white/45" /></div>}
      {format === 'Carousel' && <><span className="absolute right-3 top-3 rounded-full bg-black/45 px-2 py-1 text-[10px] font-semibold text-white">1 / 3</span><div className="absolute bottom-3 flex gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /><span className="h-1.5 w-1.5 rounded-full bg-white/70" /><span className="h-1.5 w-1.5 rounded-full bg-white/70" /></div></>}
    </div>
    {!vertical && <div className="px-4 py-3"><div className="mb-2 flex justify-between text-xl"><span>♡　◯　⌁</span><span>⌑</span></div><p className="line-clamp-3 text-xs leading-relaxed"><strong className="mr-1">{task.client?.prefix?.toLowerCase()}</strong>{task.caption || task.title}</p></div>}
  </div>;
}

function DetailModal({ task, onClose }: { task: CoyoTask; onClose: () => void }) {
  const isPost = task.category !== 'TASK';
  const attachment = firstAttachmentLink(task);
  const description = task.description?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const dates: [string, string | null][] = [['Created', task.createdAt], ['Delivery', task.deliveryDate], ...(isPost ? [['Post date', task.postDate], ['Execution', task.executionDate]] as [string, string | null][] : [])];
  return <div className="coyo-modal-backdrop fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="coyo-detail-title" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="coyo-modal-panel max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-card shadow-2xl ring-1 ring-white/10">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-5 border-b border-border-custom bg-card/95 px-6 py-5 backdrop-blur"><div className="min-w-0"><p className="mb-1 text-xs font-semibold uppercase tracking-[.16em] text-emerald-600">{task.displayId} · {isPost ? socialFormat(task.category) : 'Task'}</p><h3 id="coyo-detail-title" className="text-xl font-bold leading-tight">{task.title}</h3></div><button onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-custom text-xl transition hover:scale-105 hover:bg-border-custom" aria-label="Close details">×</button></header>
      <div className={`grid gap-8 p-6 ${isPost || attachment ? 'lg:grid-cols-[minmax(0,1fr)_minmax(300px,.82fr)]' : ''}`}>
        <div className="space-y-7"><div className="flex flex-wrap items-center gap-2"><StatusTag status={task.status} /><span className="text-sm text-muted">{task.workspace}</span></div><div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">{dates.map(([label, value]) => <div key={label}><p className="text-xs text-muted">{label}</p><p className="mt-1 text-sm font-semibold">{formatBrazilianDate(value)}</p></div>)}</div><div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Tags</p><TagList task={task} /></div><div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Description</p><p className="whitespace-pre-wrap text-sm leading-6">{description || 'No description.'}</p></div>{task.caption && <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Caption</p><p className="whitespace-pre-wrap text-sm leading-6">{task.caption}</p></div>}{attachment && <a href={attachment} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">Open attached file ↗</a>}</div>
        {isPost ? <InstagramPreview task={task} /> : attachment ? <div className="min-h-[440px] overflow-hidden rounded-2xl border border-border-custom bg-accent-custom"><iframe src={attachment} title={`Attached file for ${task.title}`} className="h-[520px] w-full bg-white" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups" /><p className="sr-only">If the preview is unavailable, use the open attached file link.</p></div> : null}
      </div>
    </div>
  </div>;
}

function TasksTable({ tasks, social, onSelect }: { tasks: CoyoTask[]; social: boolean; onSelect: (task: CoyoTask) => void }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border-custom text-xs uppercase tracking-wide text-muted"><tr>{['Item', 'Status', 'Created', 'Delivery', ...(social ? ['Post date', 'Execution'] : []), 'Resources'].map(label => <th className="px-3 py-3 font-semibold" key={label}>{label}</th>)}</tr></thead><tbody>{tasks.map(task => <tr key={task.id} className="group border-b border-border-custom transition hover:bg-accent-custom/70"><td className="px-3 py-4"><button onClick={() => onSelect(task)} className="max-w-sm text-left font-semibold leading-snug transition group-hover:text-emerald-700 dark:group-hover:text-emerald-400"><span className="mb-1 block text-[11px] font-medium text-muted">{task.displayId}</span>{task.title}</button></td><td className="px-3"><StatusTag status={task.status} /></td>{[task.createdAt, task.deliveryDate, ...(social ? [task.postDate, task.executionDate] : [])].map((date, index) => <td key={index} className="whitespace-nowrap px-3 tabular-nums">{formatBrazilianDate(date)}</td>)}<td className="px-3">{safeLink(task.driveLink) ? <a href={safeLink(task.driveLink)!} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">Open ↗</a> : '—'}</td></tr>)}</tbody></table></div>;
}

export function CoyoTasksDashboardView({ selectedAccountId }: { selectedAccountId: string }) {
  const [tasks, setTasks] = useState<CoyoTask[]>([]), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  const [section, setSection] = useState<Section>('dash');
  const [filtersBySection, setFilters] = useState<FiltersState>(defaultFilters);
  const [presets, setPresets] = useState<PresetsState>({ dash: '7', tasks: '7', social: '7' });
  const [storageReady, setStorageReady] = useState(false), [view, setView] = useState('list');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selected, setSelected] = useState<CoyoTask | null>(null);
  const filters = filtersBySection[section];
  const update = (patch: Partial<TaskFilters>) => setFilters(current => ({ ...current, [section]: { ...current[section], ...patch } }));

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try { const saved = window.localStorage.getItem(STORAGE_KEY); if (saved) { const parsed = JSON.parse(saved); if (parsed.filtersBySection) setFilters(parsed.filtersBySection); if (parsed.presets) setPresets(parsed.presets); } } catch { /* Invalid or unavailable browser storage. */ }
      setStorageReady(true);
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { if (storageReady) window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ filtersBySection, presets })); }, [filtersBySection, presets, storageReady]);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) { setLoading(true); setError(''); setTasks([]); setSelected(null); } });
    fetch(`/api/coyo/tasks?mainAccountId=${encodeURIComponent(selectedAccountId)}`, { signal: controller.signal }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to load tasks'); return body.tasks; }).then(data => { if (!controller.signal.aborted) setTasks(data); }).catch(err => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selectedAccountId, revision]);
  useEffect(() => { if (!selected) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); }; document.addEventListener('keydown', close); const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.removeEventListener('keydown', close); document.body.style.overflow = overflow; }; }, [selected]);

  const invalidRange = !!filters.from && !!filters.to && filters.from > filters.to;
  const filtered = invalidRange ? [] : filterTasks(tasks, filters, section);
  const taskGroups = section === 'tasks' ? groupTasksByExactTags(filtered) : [];
  const monthDate = new Date(`${month}-01T00:00:00Z`), days = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate(), offset = monthDate.getUTCDay();
  const changeMonth = (delta: number) => { const date = new Date(monthDate); date.setUTCMonth(date.getUTCMonth() + delta); setMonth(date.toISOString().slice(0, 7)); };
  const selectPreset = (value: RangePreset) => { setPresets(current => ({ ...current, [section]: value })); if (value !== 'custom') update(presetDates(Number(value))); };
  const resetFilters = () => { setFilters(current => ({ ...current, [section]: defaultFilters()[section] })); setPresets(current => ({ ...current, [section]: '7' })); };

  return <section className="space-y-7" aria-label="Coyô Tasks">
    <div className="flex items-center justify-between gap-4"><div><h2 className="text-2xl font-bold tracking-tight">Coyô Tasks</h2><p className="mt-1 text-sm text-muted">Customer work, delivery progress, and social planning.</p></div><button className={`${control} font-semibold`} disabled={loading} onClick={() => setRevision(value => value + 1)}>↻ Refresh</button></div>
    <div className="flex gap-7 border-b border-border-custom" aria-label="Coyô sections">{(['dash', 'tasks', 'social'] as const).map(tab => <button key={tab} aria-pressed={section === tab} onClick={() => { setSection(tab); setSelected(null); }} className={`border-b-2 pb-3 font-semibold capitalize transition ${section === tab ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-muted hover:text-foreground'}`}>{tab}</button>)}</div>
    <div className="rounded-2xl bg-accent-custom/70 p-4"><div className="flex flex-wrap items-end gap-3"><label className="text-xs font-medium text-muted">Period<select aria-label="Period" className={`${control} mt-1 block min-w-36`} value={presets[section]} onChange={event => selectPreset(event.target.value as RangePreset)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="60">Last 60 days</option><option value="90">Last 90 days</option><option value="custom">Custom period</option></select></label>{presets[section] === 'custom' && <><label className="text-xs font-medium text-muted">From<input aria-label="From" type="date" className={`${control} mt-1 block`} value={filters.from} onChange={event => update({ from: event.target.value })} /></label><label className="text-xs font-medium text-muted">To<input aria-label="To" type="date" className={`${control} mt-1 block`} value={filters.to} onChange={event => update({ to: event.target.value })} /></label></>}<label className="text-xs font-medium text-muted">Date type<select aria-label="Date type" className={`${control} mt-1 block`} value={filters.dateField} onChange={event => update({ dateField: event.target.value as DateField })}>{Object.entries(dateFields).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="text-xs font-medium text-muted">Status<select aria-label="Status" className={`${control} mt-1 block`} value={filters.status} onChange={event => update({ status: event.target.value })}><option value="">All statuses</option>{statuses.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label><label className="min-w-52 flex-1 text-xs font-medium text-muted">Search<input aria-label="Search" type="search" className={`${control} mt-1 block w-full`} placeholder="Title, code, or caption" value={filters.search} onChange={event => update({ search: event.target.value })} /></label><button className={`${control} bg-transparent`} onClick={resetFilters}>Reset</button></div><p className="mt-3 text-xs text-muted">{formatBrazilianDate(filters.from)} — {formatBrazilianDate(filters.to)} · Saved automatically on this device.</p></div>
    {invalidRange && <p role="alert" className="text-sm font-medium text-red-600">From must be on or before To.</p>}
    {loading ? <p role="status" className="py-12 text-muted">Loading Coyô tasks…</p> : error ? <p role="alert" className="py-8 text-red-600">{error}</p> : section === 'dash' ? <>
      <div className="flex flex-wrap gap-x-14 gap-y-6 border-b border-border-custom pb-7">{[['Total items', filtered.length], ['Tasks', filtered.filter(task => task.category === 'TASK').length], ['Social posts', filtered.filter(task => task.category !== 'TASK').length]].map(([label, count]) => <div key={label}><p className="text-sm text-muted">{label}</p><p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">{count}</p></div>)}</div><WeeklyChart tasks={filtered} filters={filters} /><div><h3 className="font-semibold">Items by status</h3><div className="mt-5 space-y-4">{statuses.map(status => { const count = filtered.filter(task => task.status === status).length; return <div key={status} className="grid grid-cols-[155px_1fr_40px] items-center gap-4 text-sm"><StatusTag status={status} /><div className="h-2 overflow-hidden rounded-full bg-accent-custom"><div className="h-full rounded-full bg-emerald-600 transition-all duration-700" style={{ width: `${filtered.length ? count / filtered.length * 100 : 0}%` }} /></div><span className="text-right tabular-nums">{count}</span></div>; })}</div></div>
    </> : <>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted">{filtered.length} {section === 'social' ? 'posts' : 'tasks'}</p>{section === 'social' && <div className="flex rounded-xl bg-accent-custom p-1">{['list', 'calendar'].map(mode => <button key={mode} className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${view === mode ? 'bg-card text-emerald-700 shadow-sm dark:text-emerald-400' : 'text-muted'}`} aria-pressed={view === mode} onClick={() => setView(mode)}>{mode}</button>)}</div>}</div>
      {section === 'social' && view === 'calendar' ? <><div className="flex items-center justify-between"><button className={control} aria-label="Previous month" onClick={() => changeMonth(-1)}>←</button><h3 className="font-semibold capitalize">{monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h3><button className={control} aria-label="Next month" onClick={() => changeMonth(1)}>→</button></div><div className="overflow-x-auto"><div className="grid min-w-[700px] grid-cols-7 overflow-hidden rounded-2xl border-l border-t border-border-custom">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(day => <div key={day} className="border-b border-r border-border-custom bg-accent-custom p-2 text-xs font-semibold text-muted">{day}</div>)}{Array.from({ length: Math.ceil((days + offset) / 7) * 7 }, (_, index) => { const day = index - offset + 1, date = `${month}-${String(day).padStart(2, '0')}`; return <div key={index} className="min-h-28 border-b border-r border-border-custom p-2">{day > 0 && day <= days && <><p className="mb-2 text-xs text-muted">{day}</p>{filtered.filter(task => task[filters.dateField]?.slice(0, 10) === date).map(task => <button key={task.id} onClick={() => setSelected(task)} className="mb-2 block w-full rounded-lg bg-accent-custom p-2 text-left text-xs transition hover:bg-emerald-100 dark:hover:bg-emerald-950"><span className="font-semibold">{task.title}</span><span className="mt-1 block"><StatusTag status={task.status} /></span></button>)}</>}</div>; })}</div></div><p className="text-sm text-muted">{filtered.filter(task => !task[filters.dateField]).length} posts have no {dateFields[filters.dateField].toLowerCase()}. Use List to see them.</p></> : filtered.length === 0 ? <p className="py-12 text-center text-muted">No {section === 'social' ? 'posts' : 'tasks'} match these filters.</p> : section === 'tasks' ? <div className="space-y-8">{taskGroups.map(group => <section key={group.key} aria-label={group.tags.length ? `Tasks tagged ${group.tags.join(', ')}` : 'Untagged tasks'}><div className="mb-3 flex items-center gap-3"><div className="flex flex-wrap gap-1.5">{group.tags.length ? group.tags.map(tag => <span key={tag} className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{tag}</span>) : <span className="text-sm font-semibold text-muted">Untagged</span>}</div><span className="text-xs tabular-nums text-muted">{group.tasks.length}</span><span className="h-px flex-1 bg-border-custom" /></div><TasksTable tasks={group.tasks} social={false} onSelect={setSelected} /></section>)}</div> : <TasksTable tasks={filtered} social onSelect={setSelected} />}
    </>}
    {selected && <DetailModal task={selected} onClose={() => setSelected(null)} />}
  </section>;
}
