import { NextResponse } from 'next/server';
import { authzErrorResponse, requireMainAccountAccess } from '@/lib/authz';
import { CoyoTasksError, createCoyoTaskForAccount, fetchCoyoTasksForAccount, type NewCoyoTaskInput } from '@/lib/coyoTasksServer';

const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('mainAccountId');
  if (!id) return NextResponse.json({ error: 'Missing mainAccountId' }, { status: 400 });
  try {
    await requireMainAccountAccess(id);
    const tasks = await fetchCoyoTasksForAccount(id);
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
    await requireMainAccountAccess(mainAccountId);

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

    const input: NewCoyoTaskInput = { title, description, dueDate, workspace, attachments };
    const task = await createCoyoTaskForAccount(mainAccountId, input);
    return NextResponse.json({ task }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return authzErrorResponse(error)
      || (error instanceof CoyoTasksError ? NextResponse.json({ error: error.message }, { status: error.status }) : null)
      || NextResponse.json({ error: 'Unable to create the Coyô task. Please try again.' }, { status: 502 });
  }
}
