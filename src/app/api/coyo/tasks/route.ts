import { NextResponse } from 'next/server';
import { authzErrorResponse, requireMainAccountAccess } from '@/lib/authz';
import { CoyoTasksError, createCoyoTaskForAccount, fetchCoyoTasksForAccount, type NewCoyoTaskInput } from '@/lib/coyoTasksServer';
import type { CoyoApiDateType } from '@/lib/coyoTasks';

const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const DATE_TYPES = new Set<CoyoApiDateType>(['createdAt', 'dueDate', 'deliveryDate', 'postDate']);

function isoDateValue(searchParams: URLSearchParams, name: 'from' | 'to') {
  const value = searchParams.get(name)?.trim() || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const id = searchParams.get('mainAccountId');
  if (!id) return NextResponse.json({ error: 'Missing mainAccountId' }, { status: 400 });
  const rawDateType = searchParams.get('dateType');
  if (rawDateType && !DATE_TYPES.has(rawDateType as CoyoApiDateType)) return NextResponse.json({ error: 'Invalid dateType' }, { status: 400 });
  const rawFrom = searchParams.get('from');
  const rawTo = searchParams.get('to');
  const from = isoDateValue(searchParams, 'from');
  const to = isoDateValue(searchParams, 'to');
  if (rawFrom && !from) return NextResponse.json({ error: 'Invalid from date' }, { status: 400 });
  if (rawTo && !to) return NextResponse.json({ error: 'Invalid to date' }, { status: 400 });
  if (from && to && from > to) return NextResponse.json({ error: 'From must be on or before To.' }, { status: 400 });
  try {
    await requireMainAccountAccess(id);
    const tasks = await fetchCoyoTasksForAccount(id, { dateType: rawDateType as CoyoApiDateType | undefined, from: from || undefined, to: to || undefined });
    return NextResponse.json({ tasks }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return authzErrorResponse(error)
      || (error instanceof CoyoTasksError ? NextResponse.json({ error: error.message }, { status: error.status }) : null)
      || NextResponse.json({ error: 'Unable to load Coyô tasks. Please try again.' }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const mainAccountId = textValue(formData, 'mainAccountId');
    if (!mainAccountId) return NextResponse.json({ error: 'Missing mainAccountId' }, { status: 400 });
    const user = await requireMainAccountAccess(mainAccountId);

    const title = textValue(formData, 'title');
    const description = textValue(formData, 'description');
    const dueDate = textValue(formData, 'dueDate');
    const workspace = textValue(formData, 'workspace').toUpperCase() || 'AGENCY';
    const attachments = formData.getAll('attachments').filter((value): value is File => typeof value !== 'string' && value.size > 0);

    if (!title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    if (title.length > 240) return NextResponse.json({ error: 'Title must be 240 characters or fewer.' }, { status: 400 });
    if (dueDate && Number.isNaN(Date.parse(dueDate))) return NextResponse.json({ error: 'Due date must be a valid ISO date.' }, { status: 400 });
    if (workspace !== 'AGENCY' && workspace !== 'SOFTWARE') return NextResponse.json({ error: 'Workspace must be AGENCY or SOFTWARE.' }, { status: 400 });
    if (attachments.length > MAX_ATTACHMENTS) return NextResponse.json({ error: 'You can attach up to 10 files.' }, { status: 400 });
    const oversized = attachments.find(file => file.size > MAX_ATTACHMENT_BYTES);
    if (oversized) return NextResponse.json({ error: `${oversized.name} exceeds the 5 MB attachment limit.` }, { status: 400 });

    const authorName = user.name?.trim() || user.email;
    const input: NewCoyoTaskInput = { title, description, dueDate, workspace, attachments, authorName };
    const task = await createCoyoTaskForAccount(mainAccountId, input);
    return NextResponse.json({ task }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return authzErrorResponse(error)
      || (error instanceof CoyoTasksError ? NextResponse.json({ error: error.message }, { status: error.status }) : null)
      || NextResponse.json({ error: 'Unable to create the Coyô task. Please try again.' }, { status: 502 });
  }
}
