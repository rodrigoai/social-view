'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Loader2, Paperclip, Plus, X } from 'lucide-react';
import { useSession } from 'next-auth/react';

const inputClass = 'mt-1.5 block w-full rounded-xl border border-border-custom bg-card px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15';
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function todayInputDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

type CreatedTask = {
  id: string;
  displayId: string;
  status: 'BACKLOG';
  attachments: { fileName: string; url?: string; mimeType?: string; error?: string }[];
  warning?: string;
};

type Props = {
  mainAccountId: string;
  clientName: string;
  clientAcronym?: string | null;
  onClose: () => void;
  onCreated: () => void;
};

export function NewCoyoTaskModal({ mainAccountId, clientName, clientAcronym, onClose, onCreated }: Props) {
  const { data: session } = useSession();
  const titleRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedTask | null>(null);
  const requester = session?.user?.name || session?.user?.email || 'Current user';

  useEffect(() => {
    titleRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, submitting]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const body = new FormData(event.currentTarget);
      const attachments = body.getAll('attachments').filter((value): value is File => typeof value !== 'string' && value.size > 0);
      if (attachments.length > 10) throw new Error('You can attach up to 10 files.');
      const oversized = attachments.find(file => file.size > MAX_ATTACHMENT_BYTES);
      if (oversized) throw new Error(`${oversized.name} exceeds the 5 MB attachment limit.`);
      body.set('mainAccountId', mainAccountId);
      const response = await fetch('/api/coyo/tasks', { method: 'POST', body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to create this task.');
      setCreated(payload.task);
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create this task.');
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="coyo-modal-backdrop fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="new-coyo-task-title" onMouseDown={event => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
    <div className="coyo-modal-panel my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-border-custom bg-card shadow-2xl">
      <header className="flex items-start justify-between gap-6 border-b border-border-custom px-6 py-5">
        <div>
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-emerald-600"><Plus size={14} aria-hidden="true" /> New backlog item</p>
          <h3 id="new-coyo-task-title" className="text-xl font-bold tracking-tight">Create a Coyô task</h3>
          <p className="mt-1 text-sm text-muted">It will enter Backlog unassigned for human triage.</p>
        </div>
        <button type="button" onClick={onClose} disabled={submitting} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-custom text-muted transition hover:scale-105 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50" aria-label="Close new task"><X size={19} /></button>
      </header>

      {created ? <div className="px-6 py-10 text-center" role="status">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Check size={24} /></span>
        <h4 className="mt-4 text-lg font-bold">Task added to Backlog</h4>
        <p className="mt-1 text-sm text-muted"><strong className="text-foreground">{created.displayId}</strong> is ready for triage.</p>
        {created.warning && <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">{created.warning}</p>}
        <button type="button" onClick={onClose} className="mt-6 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">Done</button>
      </div> : <form onSubmit={submit} className="space-y-5 px-6 py-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted">User<input aria-label="User" value={requester} readOnly className={`${inputClass} cursor-not-allowed bg-accent-custom`} /></label>
          <label className="text-xs font-medium text-muted">Client<input aria-label="Client" value={`${clientName}${clientAcronym ? ` (${clientAcronym})` : ''}`} readOnly className={`${inputClass} cursor-not-allowed bg-accent-custom`} /></label>
        </div>
        <label className="block text-xs font-medium text-muted">Title <span aria-hidden="true" className="text-red-500">*</span><input ref={titleRef} name="title" aria-label="Title" required maxLength={240} placeholder="What needs to be done?" className={inputClass} /></label>
        <label className="block text-xs font-medium text-muted">Description<textarea name="description" aria-label="Description" rows={5} placeholder="Add the context, requirements, and expected outcome." className={`${inputClass} resize-y`} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted">Due date<input name="dueDate" aria-label="Due date" type="date" defaultValue={todayInputDate()} className={inputClass} /></label>
          <label className="text-xs font-medium text-muted">Workspace<select name="workspace" aria-label="Workspace" defaultValue="AGENCY" className={inputClass}><option value="AGENCY">Agency</option><option value="SOFTWARE">Software</option></select></label>
        </div>
        <label className="block rounded-xl border border-dashed border-border-custom bg-accent-custom/60 px-4 py-3 text-sm transition hover:border-emerald-500">
          <span className="flex items-center gap-2 font-semibold"><Paperclip size={16} aria-hidden="true" /> Attachments</span>
          <span className="mt-1 block text-xs text-muted">Up to 10 files, 5 MB each.</span>
          <input name="attachments" aria-label="Attachments" type="file" multiple className="mt-3 block w-full text-xs text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-card file:px-3 file:py-2 file:text-xs file:font-semibold file:text-foreground" />
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        <footer className="flex items-center justify-end gap-3 border-t border-border-custom pt-5">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted transition hover:bg-accent-custom hover:text-foreground disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={submitting || !clientAcronym} className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : 'Create task'}</button>
        </footer>
        {!clientAcronym && <p role="alert" className="text-right text-xs text-amber-700 dark:text-amber-300">Configure this client’s Coyô prefix in Settings before creating tasks.</p>}
      </form>}
    </div>
  </div>;
}
