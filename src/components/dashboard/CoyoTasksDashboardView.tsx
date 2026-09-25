'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { ExternalLink, FileText, Loader2, Paperclip, Pencil, Plus, Trash2, X } from 'lucide-react';
import { CoyoTask, DateField, TaskFilters, coyoApiDateType, dateFields, filterTasks, firstAttachmentLink, formatBrazilianDate, formatBrazilianDateTime, groupTasksByExactTags, normalizePostFormats, safeLink, statuses, statusLabel, tagName, taskRichTextDescription, taskTextDescription, type CoyoPostFormat, type CoyoTaskDetail, type WorkspaceFilter } from '@/lib/coyoTasks';
import { NewCoyoTaskModal } from '@/components/dashboard/NewCoyoTaskModal';

type Section = 'dash' | 'tasks' | 'social';
type RangePreset = '7' | '30' | '60' | '90' | 'custom';
type FiltersState = Record<Section, TaskFilters>;
type PresetsState = Record<Section, RangePreset>;

const STORAGE_KEY = 'coyo-tasks-dashboard-filters:v6';
const PREVIOUS_STORAGE_KEYS = ['coyo-tasks-dashboard-filters:v5', 'coyo-tasks-dashboard-filters:v4', 'coyo-tasks-dashboard-filters:v3'];
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
  const dates = presetDates(90);
  const base = { search: '', status: '', workspace: 'AGENCY' as const, tags: [], ...dates, dateField: 'createdAt' as const };
  return { dash: { ...base }, tasks: { ...base }, social: { ...base, dateField: 'postDate' } };
}

function StatusTag({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize leading-none ${statusStyles[status] || statusStyles.BACKLOG}`}>{statusLabel(status)}</span>;
}

function PostTypeTags({ task }: { task: CoyoTask }) {
  const postTypes = normalizePostFormats(task.postFormat, task.category);
  if (!postTypes.length) return <span className="text-muted">—</span>;
  return <span className="inline-flex flex-wrap gap-1.5">{postTypes.map(postType => <span key={postType} className="rounded-md bg-accent-custom px-2 py-1 text-xs font-semibold text-foreground">{postType}</span>)}</span>;
}

function TagList({ task }: { task: CoyoTask }) {
  if (!task.tags?.length) return <span className="text-muted">No tags</span>;
  return <span className="inline-flex flex-wrap gap-1.5">{task.tags.map((tag, index) => <span key={`${tagName(tag)}-${index}`} className="rounded-md bg-accent-custom px-2 py-1 text-xs font-medium">{tagName(tag)}</span>)}</span>;
}

function TagFilter({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (tags: string[]) => void }) {
  const toggle = (tag: string) => onChange(selected.includes(tag) ? selected.filter(item => item !== tag) : [...selected, tag]);

  return <div className="relative text-xs font-medium text-muted">
    <span>Tags</span>
    <details className="relative mt-1">
      <summary aria-label="Tag filters" className={`${control} min-w-40 cursor-pointer list-none pr-9 text-foreground marker:content-none`}>{selected.length ? `${selected.length} selected` : 'All tags'}<span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">⌄</span></summary>
      <div className="absolute left-0 top-[calc(100%+.4rem)] z-30 w-64 rounded-xl border border-border-custom bg-card p-2 text-foreground shadow-xl">
        {options.length ? <div className="max-h-64 overflow-y-auto">{options.map(tag => <label key={tag} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition hover:bg-accent-custom"><input type="checkbox" aria-label={`Filter by tag ${tag}`} checked={selected.includes(tag)} onChange={() => toggle(tag)} className="h-4 w-4 accent-emerald-600" /><span className="truncate">{tag}</span></label>)}</div> : <p className="px-2.5 py-2 text-sm text-muted">No tags available</p>}
        {selected.length > 0 && <button type="button" onClick={() => onChange([])} className="mt-1 w-full border-t border-border-custom px-2.5 pt-2 text-left text-xs font-semibold text-emerald-700 dark:text-emerald-400">Clear tag filters</button>}
      </div>
    </details>
  </div>;
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

function driveManifestUrl(mainAccountId: string, taskId: string) {
  return `/api/coyo/files?mainAccountId=${encodeURIComponent(mainAccountId)}&taskId=${encodeURIComponent(taskId)}`;
}

function attachmentPreviewUrl(mainAccountId: string, taskId: string, fileId?: string) {
  const base = `/api/coyo/files/preview?mainAccountId=${encodeURIComponent(mainAccountId)}&taskId=${encodeURIComponent(taskId)}`;
  return fileId ? `${base}&fileId=${encodeURIComponent(fileId)}` : base;
}

type DriveFile = { id: string; name: string; mimeType: string };
type DriveFormatGroup = { format: CoyoPostFormat; files: DriveFile[] };
type DriveManifest = { isFolder: boolean; name: string; files: DriveFile[]; driveUrl?: string; formats?: DriveFormatGroup[] };

function DriveFileContent({ file, src, title, cover = false }: { file: DriveFile; src: string; title: string; cover?: boolean }) {
  if (file.mimeType.startsWith('image/')) return <Image src={src} alt={file.name} fill unoptimized sizes="(max-width: 1024px) 100vw, 42vw" className={cover ? 'object-cover' : 'object-contain'} />;
  if (file.mimeType.startsWith('video/')) return <video src={src} title={title} controls playsInline preload="metadata" className={`block h-full w-full ${cover ? 'object-cover' : 'object-contain'}`} />;
  if (file.mimeType.startsWith('audio/')) return <audio src={src} title={title} controls preload="metadata" className="w-[min(34rem,86%)]" />;
  const canEmbed = file.mimeType === 'application/pdf' || file.mimeType.startsWith('text/') || file.mimeType.startsWith('application/vnd.google-apps.');
  if (canEmbed) return <iframe src={src} title={title} className="block h-full w-full border-0 bg-white" referrerPolicy="no-referrer" sandbox="" />;
  return <div className="max-w-sm px-6 text-center"><p className="font-semibold">Preview unavailable</p><p className="mt-2 text-sm text-muted">Open this file in Drive to view its contents.</p></div>;
}

function DriveMediaCanvas({ file, previewUrl, manifest, error, multiple, move, className, cover = false }: { file?: DriveFile; previewUrl: string; manifest: DriveManifest | null; error: string; multiple: boolean; move: (delta: number) => void; className: string; cover?: boolean }) {
  return <div className={`relative grid min-w-0 place-items-center overflow-hidden bg-accent-custom ${className}`} tabIndex={multiple ? 0 : undefined} onKeyDown={event => { if (event.key === 'ArrowLeft') move(-1); if (event.key === 'ArrowRight') move(1); }}>
    {!manifest && !error && <div className="text-sm text-muted">Loading preview…</div>}
    {error && <div className="max-w-sm px-6 text-center"><p className="font-semibold">Preview unavailable</p><p className="mt-2 text-sm text-muted">{error}</p></div>}
    {manifest && !file && <div className="max-w-sm px-6 text-center"><p className="font-semibold">This folder is empty</p><p className="mt-2 text-sm text-muted">No previewable files were found in the linked folder.</p></div>}
    {file && !previewUrl && <div className="text-sm text-muted">Caching image…</div>}
    {file && previewUrl && <DriveFileContent file={file} src={previewUrl} title={`Drive preview: ${file.name}`} cover={cover} />}
    {multiple && <><button type="button" onClick={() => move(-1)} aria-label="Previous Drive file" className="absolute left-2 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-slate-950/65 text-xl text-white shadow-lg backdrop-blur transition hover:bg-slate-950/85">‹</button><button type="button" onClick={() => move(1)} aria-label="Next Drive file" className="absolute right-2 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-slate-950/65 text-xl text-white shadow-lg backdrop-blur transition hover:bg-slate-950/85">›</button></>}
  </div>;
}

function DrivePreview({ task, mainAccountId, social, editable = false, onAttachmentsChanged }: { task: CoyoTask; mainAccountId: string; social: boolean; editable?: boolean; onAttachmentsChanged?: () => void }) {
  const [manifest, setManifest] = useState<DriveManifest | null>(null);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [formatIndex, setFormatIndex] = useState(0);
  const [imageCache, setImageCache] = useState<Record<string, string>>({});
  const [failedImageCache, setFailedImageCache] = useState<Set<string>>(() => new Set());
  const [removeCandidate, setRemoveCandidate] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(driveManifestUrl(mainAccountId, task.id), { signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to load this Drive link.'); return body; })
      .then(data => { if (!controller.signal.aborted) setManifest(data); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load this Drive link.'); });
    return () => controller.abort();
  }, [mainAccountId, task.id]);

  useEffect(() => {
    if (!manifest || typeof URL.createObjectURL !== 'function') return;
    const controller = new AbortController();
    const objectUrls: string[] = [];
    const allFiles = [...manifest.files, ...(manifest.formats || []).flatMap(group => group.files)];
    const images = [...new Map(allFiles.filter(item => item.mimeType.startsWith('image/')).map(item => [item.id, item])).values()];
    images.forEach(async imageFile => {
      const source = attachmentPreviewUrl(mainAccountId, task.id, manifest.isFolder || manifest.files.length > 1 ? imageFile.id : undefined);
      try {
        const response = await fetch(source, { signal: controller.signal });
        if (!response.ok) throw new Error('Unable to cache image.');
        const objectUrl = URL.createObjectURL(await response.blob());
        if (controller.signal.aborted) { URL.revokeObjectURL(objectUrl); return; }
        objectUrls.push(objectUrl);
        setImageCache(current => ({ ...current, [imageFile.id]: objectUrl }));
      } catch {
        if (!controller.signal.aborted) setFailedImageCache(current => new Set(current).add(imageFile.id));
      }
    });
    return () => {
      controller.abort();
      objectUrls.forEach(objectUrl => URL.revokeObjectURL(objectUrl));
    };
  }, [mainAccountId, manifest, task.id]);

  const formatGroups = manifest?.formats || [];
  const fallbackFormat = normalizePostFormats(task.postFormat, task.category)[0];
  const activeFormat = formatGroups[formatIndex] || (fallbackFormat ? { format: fallbackFormat, files: manifest?.files || [] } : undefined);
  const files = activeFormat?.files || manifest?.files || [];
  const file = files[index];
  const multiple = files.length > 1;
  const isStory = activeFormat?.format === 'Story';
  const move = (delta: number) => setIndex(current => (current + delta + files.length) % files.length);
  const sourcePreviewUrl = file ? attachmentPreviewUrl(mainAccountId, task.id, manifest?.isFolder || files.length > 1 ? file.id : undefined) : '';
  const taskDriveLink = safeLink(task.driveLink) || safeLink(manifest?.driveUrl || null);
  const supportsTemporaryCache = typeof URL.createObjectURL === 'function';
  const previewUrl = file?.mimeType.startsWith('image/') && supportsTemporaryCache
    ? imageCache[file.id] || (failedImageCache.has(file.id) ? sourcePreviewUrl : '')
    : sourcePreviewUrl;
  const indicators = multiple && <div className="flex justify-center gap-1.5" aria-label="Drive folder files">{files.map((item, itemIndex) => <button key={item.id} type="button" onClick={() => setIndex(itemIndex)} aria-label={`Show ${item.name}`} aria-current={itemIndex === index ? 'true' : undefined} className={`h-1.5 rounded-full transition-all ${itemIndex === index ? 'w-6 bg-emerald-600' : 'w-1.5 bg-slate-300 hover:bg-slate-400'}`} />)}</div>;

  const removeAttachment = async (attachment: DriveFile) => {
    setRemovingId(attachment.id);
    setAttachmentError('');
    try {
      const response = await fetch(`/api/coyo/tasks/${encodeURIComponent(task.id)}/attachments/${encodeURIComponent(attachment.id)}?mainAccountId=${encodeURIComponent(mainAccountId)}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'Unable to remove this attachment.');
      }
      onAttachmentsChanged?.();
    } catch (cause) {
      setAttachmentError(cause instanceof Error ? cause.message : 'Unable to remove this attachment.');
      setRemovingId(null);
      setRemoveCandidate(null);
    }
  };

  return <section className="min-w-0" aria-label="Google Drive preview">
    <div className="mb-3 flex min-w-0 items-center justify-between gap-4"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-muted">Drive preview</p><p className="mt-1 truncate text-sm font-semibold" title={file?.name || manifest?.name}>{file?.name || manifest?.name || 'Loading Drive content…'}</p></div>{multiple && <span className="shrink-0 text-xs tabular-nums text-muted">{index + 1} / {files.length}</span>}</div>
    {formatGroups.length > 1 && <div className="mb-4 flex flex-wrap justify-center gap-1 rounded-xl bg-accent-custom p-1" aria-label="Post formats">{formatGroups.map((group, groupIndex) => <button key={group.format} type="button" aria-pressed={groupIndex === formatIndex} onClick={() => { setFormatIndex(groupIndex); setIndex(0); }} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${groupIndex === formatIndex ? 'bg-card text-emerald-700 shadow-sm dark:text-emerald-400' : 'text-muted hover:text-foreground'}`}>{group.format}</button>)}</div>}
    {social ? <div className="mx-auto aspect-[9/19.5] w-full max-w-[332px] rounded-[2.6rem] bg-slate-950 p-[7px] shadow-2xl" data-testid={isStory ? 'story-preview' : 'social-post-preview'}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2.15rem] bg-white text-slate-950">
        {isStory ? <div className="relative h-full min-h-0 bg-slate-950 text-white">
          <DriveMediaCanvas file={file} previewUrl={previewUrl} manifest={manifest} error={error} multiple={multiple} move={move} cover className="absolute inset-0 h-full w-full bg-slate-950 text-white" />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-28 bg-gradient-to-b from-black/65 to-transparent" />
          <div className="absolute inset-x-3 top-3 z-30 flex gap-1">{files.map((item, itemIndex) => <button key={item.id} type="button" onClick={() => setIndex(itemIndex)} aria-label={`Show ${item.name}`} className={`h-0.5 flex-1 rounded-full ${itemIndex <= index ? 'bg-white' : 'bg-white/40'}`} />)}</div>
          <div className="pointer-events-none absolute inset-x-4 top-7 z-30 flex items-center gap-2.5"><div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 text-[10px] font-black text-white">{task.client?.prefix?.slice(0, 1) || 'C'}</div><p className="text-xs font-bold text-white">{task.client?.name || 'Coyô'} <span className="ml-1 font-normal text-white/70">now</span></p></div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-32 bg-gradient-to-t from-black/65 to-transparent" />
          <div className="absolute inset-x-5 bottom-5 z-30 rounded-full border border-white/70 px-4 py-2 text-center text-xs font-medium text-white">Send message</div>
        </div> : <>
          <div className="flex h-7 shrink-0 items-center justify-between px-5 text-[10px] font-semibold"><span>9:41</span><span>● ◒ ▰</span></div>
          <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-slate-100 px-3"><div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 text-[10px] font-black text-white">{task.client?.prefix?.slice(0, 1) || 'C'}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{task.client?.name || 'Coyô'}</p><p className="text-[9px] text-slate-500">{activeFormat?.format || 'Post'} preview</p></div><span className="text-sm font-bold">•••</span></div>
          <DriveMediaCanvas file={file} previewUrl={previewUrl} manifest={manifest} error={error} multiple={multiple} move={move} className="aspect-[4/5] w-full shrink-0 bg-slate-100 text-slate-950" />
          <div className="flex h-10 shrink-0 items-center justify-between px-3 text-xl"><span aria-hidden="true">♡　◯　⌁</span><span aria-hidden="true">⌑</span></div>
          <div className="min-h-0 flex-1 overflow-hidden px-3 pb-2 text-[11px] leading-relaxed"><p className="font-semibold">Liked by your audience</p><p className="mt-1 line-clamp-3"><strong className="mr-1">{task.client?.prefix?.toLowerCase() || 'coyo'}</strong>{task.caption || task.title}</p>{multiple && <div className="mt-2">{indicators}</div>}</div>
          <div className="grid h-10 shrink-0 grid-cols-5 place-items-center border-t border-slate-100 text-base" aria-hidden="true"><span>⌂</span><span>⌕</span><span>＋</span><span>♢</span><span className="grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-[8px] text-white">{task.client?.prefix?.slice(0, 1) || 'C'}</span></div>
        </>}
      </div>
    </div> : <><DriveMediaCanvas file={file} previewUrl={previewUrl} manifest={manifest} error={error} multiple={multiple} move={move} className="h-[min(48vh,480px)] min-h-[300px] w-full rounded-2xl border border-border-custom" />{multiple && <div className="mt-3">{indicators}</div>}</>}
    {manifest && files.length > 0 && <div className="mt-5" aria-label="Attachments"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-muted">Attachments</p><span className="text-xs tabular-nums text-muted">{files.length} {files.length === 1 ? 'file' : 'files'}</span></div><div className="divide-y divide-border-custom overflow-hidden rounded-xl border border-border-custom">{files.map((item, itemIndex) => <div key={item.id} className={`px-3 py-2.5 transition ${itemIndex === index ? 'bg-emerald-50/70 dark:bg-emerald-950/25' : 'bg-card'}`}>{removeCandidate === item.id ? <div className="flex flex-wrap items-center justify-between gap-3"><p className="min-w-0 flex-1 text-xs text-red-700 dark:text-red-300">Remove <strong>{item.name}</strong> from this task and move it to Drive trash?</p><div className="flex gap-1"><button type="button" disabled={Boolean(removingId)} onClick={() => setRemoveCandidate(null)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-card">Cancel</button><button type="button" disabled={Boolean(removingId)} onClick={() => removeAttachment(item)} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{removingId === item.id && <Loader2 size={13} className="animate-spin" />} Remove</button></div></div> : <div className="flex items-center gap-3"><button type="button" onClick={() => setIndex(itemIndex)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-custom text-muted transition hover:text-foreground" aria-label={`Preview ${item.name}`}><FileText size={15} /></button><button type="button" onClick={() => setIndex(itemIndex)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-semibold">{item.name}</span><span className="block truncate text-[11px] text-muted">{item.mimeType}</span></button><a href={attachmentPreviewUrl(mainAccountId, task.id, item.id)} target="_blank" rel="noopener noreferrer" aria-label={`Open ${item.name}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-accent-custom hover:text-foreground"><ExternalLink size={15} /></a>{editable && <button type="button" onClick={() => setRemoveCandidate(item.id)} aria-label={`Remove ${item.name}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"><Trash2 size={15} /></button>}</div>}</div>)}</div></div>}
    {taskDriveLink && <a href={taskDriveLink} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border-custom px-3.5 py-3 text-sm font-semibold text-foreground transition hover:border-emerald-500 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20" aria-label="Open in Google Drive"><span>Open in Google Drive</span><ExternalLink size={16} className="shrink-0 text-emerald-600" aria-hidden="true" /></a>}
    {attachmentError && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{attachmentError}</p>}
  </section>;
}

function DetailPanel({ task, mainAccountId, onClose, onChanged }: { task: CoyoTask; mainAccountId: string; onClose: () => void; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [detail, setDetail] = useState<CoyoTaskDetail | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState('');
  const [comment, setComment] = useState('');
  const [commenting, setCommenting] = useState(false);
  const postFormats = normalizePostFormats(task.postFormat, task.category);
  const isPost = task.category !== 'TASK' || postFormats.length > 0;
  const isBacklog = task.status === 'BACKLOG';
  const attachment = firstAttachmentLink(task);
  const description = taskTextDescription(task.description);
  const richDescription = taskRichTextDescription(task.description);
  const dates: [string, string | null][] = [['Created', task.createdAt], ['Delivery', task.deliveryDate], ...(isPost ? [['Post date', task.postDate], ['Execution', task.executionDate]] as [string, string | null][] : [])];
  const comments = [...(detail?.comments || [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  useEffect(() => {
    const controller = new AbortController();
    setActivityLoading(true);
    setActivityError('');
    fetch(`/api/coyo/tasks/${encodeURIComponent(task.id)}?mainAccountId=${encodeURIComponent(mainAccountId)}`, { signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to load comments and history.'); return body.task; })
      .then(data => {
        if (!controller.signal.aborted && data?.id === task.id && Array.isArray(data.comments) && Array.isArray(data.history)) setDetail(data);
        else if (!controller.signal.aborted) throw new Error('Unable to load comments and history.');
      })
      .catch(cause => { if (!controller.signal.aborted) setActivityError(cause instanceof Error ? cause.message : 'Unable to load comments and history.'); })
      .finally(() => { if (!controller.signal.aborted) setActivityLoading(false); });
    return () => controller.abort();
  }, [mainAccountId, task.id]);

  const addComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = comment.trim();
    if (!content) return;
    setCommenting(true);
    setActivityError('');
    try {
      const response = await fetch(`/api/coyo/tasks/${encodeURIComponent(task.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainAccountId, comment: content }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to add this comment.');
      setDetail(current => payload.comment
        ? current ? { ...current, comments: [...current.comments, payload.comment] } : { ...task, comments: [payload.comment], history: [] }
        : current);
      setComment('');
    } catch (cause) {
      setActivityError(cause instanceof Error ? cause.message : 'Unable to add this comment.');
    } finally {
      setCommenting(false);
    }
  };

  const updateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWorking(true);
    setActionError('');
    const formData = new FormData(event.currentTarget);
    formData.delete('attachments');
    pendingAttachments.forEach(file => formData.append('attachments', file, file.name));
    const attachments = pendingAttachments;
    const oversized = attachments.find(file => file.size > 5 * 1024 * 1024);
    if (oversized) { setActionError(`${oversized.name} exceeds the 5 MB attachment limit.`); setWorking(false); return; }
    formData.set('mainAccountId', mainAccountId);
    try {
      const response = await fetch(`/api/coyo/tasks/${encodeURIComponent(task.id)}`, {
        method: 'PATCH',
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to update this task.');
      onChanged();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to update this task.');
      setWorking(false);
    }
  };

  const deleteTask = async () => {
    setWorking(true);
    setActionError('');
    try {
      const response = await fetch(`/api/coyo/tasks/${encodeURIComponent(task.id)}?mainAccountId=${encodeURIComponent(mainAccountId)}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'Unable to delete this task.');
      }
      onChanged();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to delete this task.');
      setWorking(false);
    }
  };

  return <div className="coyo-panel-backdrop fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="coyo-detail-title" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="coyo-detail-panel h-dvh w-full overflow-y-auto border-l border-border-custom bg-card shadow-2xl sm:max-w-xl" data-testid="coyo-detail-panel">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-5 border-b border-border-custom bg-card/95 px-6 py-5 backdrop-blur"><div className="min-w-0"><p className="mb-1 text-xs font-semibold uppercase tracking-[.16em] text-emerald-600">{task.displayId} · {isPost ? postFormats.join(' · ') || 'Post' : 'Task'}</p><h3 id="coyo-detail-title" className="text-xl font-bold leading-tight">{task.title}</h3></div><div className="flex shrink-0 items-center gap-1">{isBacklog && !editing && <><button type="button" onClick={() => { setEditing(true); setConfirmingDelete(false); setActionError(''); }} className="grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-accent-custom hover:text-foreground" aria-label="Edit task"><Pencil size={17} /></button><button type="button" onClick={() => { setConfirmingDelete(true); setActionError(''); }} className="grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" aria-label="Delete task"><Trash2 size={17} /></button></>}<button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-accent-custom text-muted transition hover:scale-105 hover:bg-border-custom hover:text-foreground" aria-label="Close details"><X size={19} /></button></div></header>
      <div className="space-y-8 p-6">
        {attachment && <DrivePreview task={task} mainAccountId={mainAccountId} social={isPost} editable={editing && isBacklog} onAttachmentsChanged={onChanged} />}
        {confirmingDelete && <section aria-label="Confirm task deletion" className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/35"><h4 className="font-bold text-red-800 dark:text-red-200">Delete {task.displayId} permanently?</h4><p className="mt-1 text-sm leading-6 text-red-700 dark:text-red-300">This cannot be undone. Coyô will also remove files uploaded as this task’s attachments.</p><div className="mt-4 flex justify-end gap-2"><button type="button" disabled={working} onClick={() => setConfirmingDelete(false)} className="rounded-xl px-3 py-2 text-sm font-semibold text-muted transition hover:bg-card">Cancel</button><button type="button" disabled={working} onClick={deleteTask} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">{working && <Loader2 size={15} className="animate-spin" />} Delete permanently</button></div></section>}
        {actionError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">{actionError}</p>}
        {editing ? <form onSubmit={updateTask} className="space-y-5"><label className="block text-xs font-medium text-muted">Title<input name="title" aria-label="Edit title" required maxLength={240} defaultValue={task.title} className={`${control} mt-1.5 block w-full`} /></label><label className="block text-xs font-medium text-muted">Description<textarea name="description" aria-label="Edit description" rows={6} defaultValue={description} className={`${control} mt-1.5 block w-full resize-y`} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-medium text-muted">Due date<input name="dueDate" aria-label="Edit due date" type="date" defaultValue={task.deliveryDate?.slice(0, 10) || ''} className={`${control} mt-1.5 block w-full`} /></label><label className="text-xs font-medium text-muted">Workspace<select name="workspace" aria-label="Edit workspace" defaultValue={task.workspace} className={`${control} mt-1.5 block w-full`}><option value="AGENCY">Agency</option><option value="SOFTWARE">Software</option></select></label></div><label className="block rounded-xl border border-dashed border-border-custom bg-accent-custom/60 px-4 py-3 text-sm transition hover:border-emerald-500"><span className="flex items-center gap-2 font-semibold"><Paperclip size={16} aria-hidden="true" /> Add attachments</span><span className="mt-1 block text-xs text-muted">Up to 10 total files, 5 MB each.</span><input name="attachments" aria-label="Add attachments" type="file" multiple onChange={event => setPendingAttachments(Array.from(event.target.files || []))} className="mt-3 block w-full text-xs text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-card file:px-3 file:py-2 file:text-xs file:font-semibold file:text-foreground" />{pendingAttachments.length > 0 && <ul className="mt-3 space-y-1.5">{pendingAttachments.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center gap-3 text-xs"><span className="min-w-0 flex-1 truncate">{file.name}</span><span className="shrink-0 tabular-nums text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</span><button type="button" onClick={() => setPendingAttachments(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove selected ${file.name}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"><X size={14} /></button></li>)}</ul>}</label><div className="flex justify-end gap-2 border-t border-border-custom pt-5"><button type="button" disabled={working} onClick={() => { setEditing(false); setActionError(''); setPendingAttachments([]); }} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted transition hover:bg-accent-custom">Cancel</button><button type="submit" disabled={working} className="inline-flex min-w-28 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">{working ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : 'Save changes'}</button></div></form> : <div className="min-w-0 space-y-7"><div className="flex flex-wrap items-center gap-2"><StatusTag status={task.status} /><span className="text-sm text-muted">{task.workspace}</span></div><div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">{dates.map(([label, value]) => <div key={label}><p className="text-xs text-muted">{label}</p><p className="mt-1 text-sm font-semibold">{formatBrazilianDate(value)}</p></div>)}</div><div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Tags</p><TagList task={task} /></div><div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Description</p>{richDescription ? <div className="coyo-rich-text break-words whitespace-pre-wrap text-sm leading-6" dangerouslySetInnerHTML={{ __html: richDescription }} /> : <p className="text-sm leading-6">No description.</p>}</div>{task.caption && <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Caption</p><p className="break-words whitespace-pre-wrap text-sm leading-6">{task.caption}</p></div>}</div>}
        <section className="border-t border-border-custom pt-7" aria-labelledby="comments-title">
          <div className="flex items-center justify-between gap-3"><h4 id="comments-title" className="font-bold">Comments</h4>{detail && <span className="text-xs tabular-nums text-muted">{detail.comments.length}</span>}</div>
          <form onSubmit={addComment} className="mt-4"><label htmlFor="coyo-comment" className="sr-only">Add a comment</label><textarea id="coyo-comment" value={comment} onChange={event => setComment(event.target.value)} rows={3} placeholder="Write a comment…" className={`${control} block w-full resize-y`} /><div className="mt-2 flex justify-end"><button type="submit" disabled={commenting || !comment.trim()} className="inline-flex min-w-28 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">{commenting ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : 'Add comment'}</button></div></form>
          {activityError && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">{activityError}</p>}
          {activityLoading ? <p role="status" className="mt-5 text-sm text-muted">Loading comments and history…</p> : comments.length ? <ol className="mt-5 space-y-4">{comments.map(item => <li key={item.id} className="rounded-xl bg-accent-custom/70 p-4"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-semibold">{item.author?.name || 'Unknown author'}</p><time dateTime={item.createdAt} className="text-xs text-muted">{formatBrazilianDateTime(item.createdAt)}</time></div><div className="coyo-rich-text mt-2 break-words text-sm leading-6" dangerouslySetInnerHTML={{ __html: item.content }} /></li>)}</ol> : !activityLoading && !activityError ? <p className="mt-5 text-sm text-muted">No comments yet.</p> : null}
        </section>
        <section className="border-t border-border-custom pt-7" aria-labelledby="history-title">
          <div className="flex items-center justify-between gap-3"><h4 id="history-title" className="font-bold">History</h4>{detail && <span className="text-xs tabular-nums text-muted">{detail.history.length}</span>}</div>
          {!activityLoading && detail?.history.length ? <ol className="relative mt-5 space-y-5 border-l border-border-custom pl-5">{detail.history.map(item => <li key={item.id} className="relative"><span className="absolute -left-[1.48rem] top-1.5 h-2 w-2 rounded-full bg-emerald-600 ring-4 ring-card" aria-hidden="true" /><p className="text-sm font-medium leading-6">{item.action}</p>{(item.oldValue !== null || item.newValue !== null) && <p className="mt-1 break-words text-xs text-muted"><span className="line-through">{item.oldValue || 'Empty'}</span><span aria-hidden="true"> → </span><span>{item.newValue || 'Empty'}</span></p>}<p className="mt-1 text-xs text-muted">{item.author.name} · <time dateTime={item.createdAt}>{formatBrazilianDateTime(item.createdAt)}</time></p></li>)}</ol> : !activityLoading && !activityError ? <p className="mt-5 text-sm text-muted">No history recorded.</p> : null}
        </section>
      </div>
    </aside>
  </div>;
}

function TasksTable({ tasks, social, showTags = false, onSelect }: { tasks: CoyoTask[]; social: boolean; showTags?: boolean; onSelect: (task: CoyoTask) => void }) {
  const columns = ['Item', 'Status', 'Workspace', ...(showTags ? ['Tags'] : []), 'Created', 'Delivery', ...(social ? ['Post type', 'Post date'] : [])];

  return <div className="overflow-x-auto"><table className="w-full text-left text-sm">
    <thead className="border-b border-border-custom text-xs uppercase tracking-wide text-muted"><tr>{columns.map(label => <th className={`px-3 py-3 font-semibold ${label === 'Post date' ? 'bg-emerald-50/80 text-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-300' : ''}`} key={label}>{label}</th>)}</tr></thead>
    <tbody>{tasks.map(task => <tr
      key={task.id}
      role="button"
      tabIndex={0}
      aria-label={`${task.displayId} ${task.title}`}
      onClick={() => onSelect(task)}
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(task); } }}
      className="group cursor-pointer border-b border-border-custom transition hover:bg-accent-custom/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
    >
      <td className="px-3 py-4"><div className="max-w-sm text-left font-semibold leading-snug transition group-hover:text-emerald-700 dark:group-hover:text-emerald-400"><span className="mb-1 block text-[11px] font-medium text-muted">{task.displayId}</span>{task.title}</div></td>
      <td className="px-3"><StatusTag status={task.status} /></td>
      <td className="whitespace-nowrap px-3 capitalize">{statusLabel(task.workspace)}</td>
      {showTags && <td className="px-3"><TagList task={task} /></td>}
      <td className="whitespace-nowrap px-3 tabular-nums">{formatBrazilianDate(task.createdAt)}</td>
      <td className="whitespace-nowrap px-3 tabular-nums">{formatBrazilianDate(task.deliveryDate)}</td>
      {social && <><td className="px-3"><PostTypeTags task={task} /></td><td className="whitespace-nowrap bg-emerald-50/80 px-3 font-bold tabular-nums text-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-300">{formatBrazilianDate(task.postDate)}</td></>}
    </tr>)}</tbody>
  </table></div>;
}

export function CoyoTasksDashboardView({ selectedAccountId, selectedAccountName = 'Selected client', selectedClientAcronym }: { selectedAccountId: string; selectedAccountName?: string; selectedClientAcronym?: string | null }) {
  const [tasks, setTasks] = useState<CoyoTask[]>([]), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  const [section, setSection] = useState<Section>('tasks');
  const [filtersBySection, setFilters] = useState<FiltersState>(defaultFilters);
  const [presets, setPresets] = useState<PresetsState>({ dash: '90', tasks: '90', social: '90' });
  const [groupTasksByTags, setGroupTasksByTags] = useState(false);
  const [storageReady, setStorageReady] = useState(false), [view, setView] = useState<'list' | 'calendar'>('list');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selected, setSelected] = useState<CoyoTask | null>(null);
  const [creating, setCreating] = useState(false);
  const filters = filtersBySection[section];
  const update = (patch: Partial<TaskFilters>) => setFilters(current => ({ ...current, [section]: { ...current[section], ...patch } }));

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        const previousKey = saved ? null : PREVIOUS_STORAGE_KEYS.find(key => window.localStorage.getItem(key));
        const previous = previousKey ? window.localStorage.getItem(previousKey) : null;
        const parsed = JSON.parse(saved || previous || 'null');
        if (parsed?.filtersBySection) {
          const defaults = defaultFilters();
          setFilters({
            dash: { ...defaults.dash, ...parsed.filtersBySection.dash, workspace: parsed.filtersBySection.dash?.workspace || 'AGENCY' },
            tasks: { ...defaults.tasks, ...parsed.filtersBySection.tasks, workspace: parsed.filtersBySection.tasks?.workspace || 'AGENCY' },
            social: { ...defaults.social, ...parsed.filtersBySection.social, dateField: previousKey ? 'postDate' : parsed.filtersBySection.social?.dateField || 'postDate', workspace: parsed.filtersBySection.social?.workspace || 'AGENCY' },
          });
        }
        if (parsed?.presets) setPresets(parsed.presets);
        if ((saved || previousKey === PREVIOUS_STORAGE_KEYS[0]) && typeof parsed?.groupTasksByTags === 'boolean') setGroupTasksByTags(parsed.groupTasksByTags);
        if (parsed?.view === 'list' || parsed?.view === 'calendar') setView(parsed.view);
      } catch { /* Invalid or unavailable browser storage. */ }
      setStorageReady(true);
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { if (storageReady) window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ filtersBySection, presets, groupTasksByTags, view })); }, [filtersBySection, presets, groupTasksByTags, view, storageReady]);
  useEffect(() => {
    if (!storageReady) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ mainAccountId: selectedAccountId, dateType: coyoApiDateType(filters.dateField) });
    if (filters.from) query.set('from', filters.from);
    if (filters.to) query.set('to', filters.to);
    queueMicrotask(() => { if (!controller.signal.aborted) { setLoading(true); setError(''); setTasks([]); setSelected(null); } });
    fetch(`/api/coyo/tasks?${query}`, { signal: controller.signal }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to load tasks'); return body.tasks; }).then(data => { if (!controller.signal.aborted) setTasks(data); }).catch(err => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selectedAccountId, revision, section, filters.dateField, filters.from, filters.to, storageReady]);
  useEffect(() => { if (!selected) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); }; document.addEventListener('keydown', close); const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.removeEventListener('keydown', close); document.body.style.overflow = overflow; }; }, [selected]);

  const invalidRange = !!filters.from && !!filters.to && filters.from > filters.to;
  const filtered = invalidRange ? [] : filterTasks(tasks, filters, section);
  const taskGroups = section === 'tasks' ? groupTasksByExactTags(filtered) : [];
  const availableTaskTags = useMemo(() => [...new Set([
    ...tasks.filter(task => task.category === 'TASK').flatMap(task => (task.tags || []).map(tagName).filter(Boolean)),
    ...(filtersBySection.tasks.tags || []),
  ])].sort((a, b) => a.localeCompare(b, 'pt-BR')), [tasks, filtersBySection.tasks.tags]);
  const monthDate = new Date(`${month}-01T00:00:00Z`), days = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate(), offset = monthDate.getUTCDay();
  const changeMonth = (delta: number) => { const date = new Date(monthDate); date.setUTCMonth(date.getUTCMonth() + delta); setMonth(date.toISOString().slice(0, 7)); };
  const selectPreset = (value: RangePreset) => { setPresets(current => ({ ...current, [section]: value })); if (value !== 'custom') update(presetDates(Number(value))); };
  const resetFilters = () => { setFilters(current => ({ ...current, [section]: defaultFilters()[section] })); setPresets(current => ({ ...current, [section]: '90' })); };

  return <section className="space-y-7" aria-label="Coyô Tasks">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-bold tracking-tight">Coyô Tasks</h2><p className="mt-1 text-sm text-muted">Customer work, delivery progress, and social planning.</p></div><div className="flex items-center gap-2"><button className={`${control} font-semibold`} disabled={loading} onClick={() => setRevision(value => value + 1)}>↻ Refresh</button><button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"><Plus size={16} aria-hidden="true" /> New Task</button></div></div>
    <div className="flex gap-7 border-b border-border-custom" aria-label="Coyô sections">{(['dash', 'tasks', 'social'] as const).map(tab => <button key={tab} aria-pressed={section === tab} onClick={() => { setSection(tab); setSelected(null); }} className={`border-b-2 pb-3 font-semibold capitalize transition ${section === tab ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-muted hover:text-foreground'}`}>{tab}</button>)}</div>
    <div className="rounded-2xl bg-accent-custom/70 p-4"><div className="flex flex-wrap items-end gap-3">
      <label className="text-xs font-medium text-muted">Period<select aria-label="Period" className={`${control} mt-1 block min-w-36`} value={presets[section]} onChange={event => selectPreset(event.target.value as RangePreset)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="60">Last 60 days</option><option value="90">Last 90 days</option><option value="custom">Custom period</option></select></label>
      {presets[section] === 'custom' && <><label className="text-xs font-medium text-muted">From<input aria-label="From" type="date" className={`${control} mt-1 block`} value={filters.from} onChange={event => update({ from: event.target.value })} /></label><label className="text-xs font-medium text-muted">To<input aria-label="To" type="date" className={`${control} mt-1 block`} value={filters.to} onChange={event => update({ to: event.target.value })} /></label></>}
      <label className="text-xs font-medium text-muted">Date type<select aria-label="Date type" className={`${control} mt-1 block`} value={filters.dateField} onChange={event => update({ dateField: event.target.value as DateField })}>{Object.entries(dateFields).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="text-xs font-medium text-muted">Status<select aria-label="Status" className={`${control} mt-1 block`} value={filters.status} onChange={event => update({ status: event.target.value })}><option value="">All statuses</option>{statuses.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
      <label className="text-xs font-medium text-muted">Workspace filter<select aria-label="Filter by workspace" className={`${control} mt-1 block`} value={filters.workspace} onChange={event => update({ workspace: event.target.value as WorkspaceFilter })}><option value="AGENCY">Agency</option><option value="SOFTWARE">Software</option><option value="">Both</option></select></label>
      {section === 'tasks' && <TagFilter options={availableTaskTags} selected={filters.tags || []} onChange={tags => update({ tags })} />}
      <label className="min-w-52 flex-1 text-xs font-medium text-muted">Search<input aria-label="Search" type="search" className={`${control} mt-1 block w-full`} placeholder="Title, code, or caption" value={filters.search} onChange={event => update({ search: event.target.value })} /></label>
      {section === 'tasks' && <label className={`${control} flex cursor-pointer items-center gap-2 bg-transparent`}><input type="checkbox" aria-label="Group by tags" checked={groupTasksByTags} onChange={event => setGroupTasksByTags(event.target.checked)} className="h-4 w-4 accent-emerald-600" /><span>Group by tags</span></label>}
      <button className={`${control} bg-transparent`} onClick={resetFilters}>Reset</button>
    </div><p className="mt-3 text-xs text-muted">{formatBrazilianDate(filters.from)} — {formatBrazilianDate(filters.to)} · Saved automatically on this device.</p></div>
    {invalidRange && <p role="alert" className="text-sm font-medium text-red-600">From must be on or before To.</p>}
    {loading ? <p role="status" className="py-12 text-muted">Loading Coyô tasks…</p> : error ? <p role="alert" className="py-8 text-red-600">{error}</p> : section === 'dash' ? <>
      <div className="flex flex-wrap gap-x-14 gap-y-6 border-b border-border-custom pb-7">{[['Total items', filtered.length], ['Tasks', filtered.filter(task => task.category === 'TASK').length], ['Social posts', filtered.filter(task => task.category !== 'TASK').length]].map(([label, count]) => <div key={label}><p className="text-sm text-muted">{label}</p><p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">{count}</p></div>)}</div><WeeklyChart tasks={filtered} filters={filters} /><div><h3 className="font-semibold">Items by status</h3><div className="mt-5 space-y-4">{statuses.map(status => { const count = filtered.filter(task => task.status === status).length; return <div key={status} className="grid grid-cols-[155px_1fr_40px] items-center gap-4 text-sm"><StatusTag status={status} /><div className="h-2 overflow-hidden rounded-full bg-accent-custom"><div className="h-full rounded-full bg-emerald-600 transition-all duration-700" style={{ width: `${filtered.length ? count / filtered.length * 100 : 0}%` }} /></div><span className="text-right tabular-nums">{count}</span></div>; })}</div></div>
    </> : <>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted">{filtered.length} {section === 'social' ? 'posts' : 'tasks'}</p>{section === 'social' && <div className="flex rounded-xl bg-accent-custom p-1">{(['list', 'calendar'] as const).map(mode => <button key={mode} className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${view === mode ? 'bg-card text-emerald-700 shadow-sm dark:text-emerald-400' : 'text-muted'}`} aria-pressed={view === mode} onClick={() => setView(mode)}>{mode}</button>)}</div>}</div>
      {section === 'social' && view === 'calendar' ? <><div className="flex items-center justify-between"><button className={control} aria-label="Previous month" onClick={() => changeMonth(-1)}>←</button><h3 className="font-semibold capitalize">{monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h3><button className={control} aria-label="Next month" onClick={() => changeMonth(1)}>→</button></div><div className="overflow-x-auto"><div className="grid min-w-[700px] grid-cols-7 overflow-hidden rounded-2xl border-l border-t border-border-custom">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(day => <div key={day} className="border-b border-r border-border-custom bg-accent-custom p-2 text-xs font-semibold text-muted">{day}</div>)}{Array.from({ length: Math.ceil((days + offset) / 7) * 7 }, (_, index) => { const day = index - offset + 1, date = `${month}-${String(day).padStart(2, '0')}`; return <div key={index} className="min-h-28 border-b border-r border-border-custom p-2">{day > 0 && day <= days && <><p className="mb-2 text-xs text-muted">{day}</p>{filtered.filter(task => task[filters.dateField]?.slice(0, 10) === date).map(task => <button key={task.id} onClick={() => setSelected(task)} className="mb-2 block w-full rounded-lg bg-accent-custom p-2 text-left text-xs transition hover:bg-emerald-100 dark:hover:bg-emerald-950"><span className="font-semibold">{task.title}</span><span className="mt-1 block"><StatusTag status={task.status} /></span></button>)}</>}</div>; })}</div></div><p className="text-sm text-muted">{filtered.filter(task => !task[filters.dateField]).length} posts have no {dateFields[filters.dateField].toLowerCase()}. Use List to see them.</p></> : filtered.length === 0 ? <p className="py-12 text-center text-muted">No {section === 'social' ? 'posts' : 'tasks'} match these filters.</p> : section === 'tasks' ? groupTasksByTags ? <div className="space-y-8">{taskGroups.map(group => <section key={group.key} aria-label={group.tags.length ? `Tasks tagged ${group.tags.join(', ')}` : 'Untagged tasks'}><div className="mb-3 flex items-center gap-3"><div className="flex flex-wrap gap-1.5">{group.tags.length ? group.tags.map(tag => <span key={tag} className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{tag}</span>) : <span className="text-sm font-semibold text-muted">Untagged</span>}</div><span className="text-xs tabular-nums text-muted">{group.tasks.length}</span><span className="h-px flex-1 bg-border-custom" /></div><TasksTable tasks={group.tasks} social={false} onSelect={setSelected} /></section>)}</div> : <TasksTable tasks={filtered} social={false} showTags onSelect={setSelected} /> : <TasksTable tasks={filtered} social onSelect={setSelected} />}
    </>}
    {selected && <DetailPanel task={selected} mainAccountId={selectedAccountId} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); setRevision(value => value + 1); }} />}
    {creating && <NewCoyoTaskModal mainAccountId={selectedAccountId} clientName={selectedAccountName} clientAcronym={selectedClientAcronym} onClose={() => setCreating(false)} onCreated={() => setRevision(value => value + 1)} />}
  </section>;
}
