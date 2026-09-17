import { NextResponse } from 'next/server';
import { authzErrorResponse, requireMainAccountAccess } from '@/lib/authz';
import { addCoyoTaskCommentForAccount, CoyoTasksError, deleteCoyoBacklogTaskForAccount, fetchCoyoTaskDetailForAccount, updateCoyoBacklogTaskForAccount, type UpdateCoyoTaskInput } from '@/lib/coyoTasksServer';

const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function errorResponse(error: unknown, fallback: string) {
  return authzErrorResponse(error)
    || (error instanceof CoyoTasksError ? NextResponse.json({ error: error.message }, { status: error.status }) : null)
    || NextResponse.json({ error: fallback }, { status: 502 });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const mainAccountId = new URL(request.url).searchParams.get('mainAccountId')?.trim() || '';
    if (!mainAccountId) return NextResponse.json({ error: 'Missing mainAccountId' }, { status: 400 });
    await requireMainAccountAccess(mainAccountId);
    const task = await fetchCoyoTaskDetailForAccount(mainAccountId, id);
    return NextResponse.json({ task }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(error, 'Unable to load the Coyô task. Please try again.');
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const multipart = request.headers.get('content-type')?.includes('multipart/form-data');
    const body = multipart ? await request.formData() : await request.json();
    const value = (name: string) => multipart ? body.get(name) : body[name];
    const mainAccountValue = value('mainAccountId');
    const mainAccountId = typeof mainAccountValue === 'string' ? mainAccountValue.trim() : '';
    if (!mainAccountId) return NextResponse.json({ error: 'Missing mainAccountId' }, { status: 400 });
    const user = await requireMainAccountAccess(mainAccountId);

    if (!multipart && Object.prototype.hasOwnProperty.call(body, 'comment')) {
      const commentValue = body.comment;
      const comment = typeof commentValue === 'string' ? commentValue.trim() : '';
      if (!comment) return NextResponse.json({ error: 'Comment is required.' }, { status: 400 });
      const externalAuthor = user.name?.trim() || user.email;
      const created = await addCoyoTaskCommentForAccount(mainAccountId, id, comment, externalAuthor);
      return NextResponse.json({ comment: created }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
    }

    const titleValue = value('title'), descriptionValue = value('description'), dueDateValue = value('dueDate'), workspaceValue = value('workspace');
    const title = typeof titleValue === 'string' ? titleValue.trim() : '';
    const description = typeof descriptionValue === 'string' ? descriptionValue.trim() : '';
    const dueDate = dueDateValue === null || dueDateValue === '' ? null : typeof dueDateValue === 'string' ? dueDateValue.trim() : '';
    const workspace = typeof workspaceValue === 'string' ? workspaceValue.toUpperCase() : '';
    const attachments: File[] = multipart ? (body as FormData).getAll('attachments').filter((entry): entry is File => typeof entry !== 'string' && entry.size > 0) : [];
    if (!title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    if (title.length > 240) return NextResponse.json({ error: 'Title must be 240 characters or fewer.' }, { status: 400 });
    if (dueDate && Number.isNaN(Date.parse(dueDate))) return NextResponse.json({ error: 'Due date must be a valid ISO date.' }, { status: 400 });
    if (workspace !== 'AGENCY' && workspace !== 'SOFTWARE') return NextResponse.json({ error: 'Workspace must be AGENCY or SOFTWARE.' }, { status: 400 });
    if (attachments.length > MAX_ATTACHMENTS) return NextResponse.json({ error: 'You can attach up to 10 files.' }, { status: 400 });
    const oversized = attachments.find(file => file.size > MAX_ATTACHMENT_BYTES);
    if (oversized) return NextResponse.json({ error: `${oversized.name} exceeds the 5 MB attachment limit.` }, { status: 400 });

    const input: UpdateCoyoTaskInput = { title, description, dueDate, workspace, attachments };
    const task = await updateCoyoBacklogTaskForAccount(mainAccountId, id, input);
    return NextResponse.json({ task }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(error, 'Unable to update the Coyô task. Please try again.');
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const mainAccountId = new URL(request.url).searchParams.get('mainAccountId')?.trim() || '';
    if (!mainAccountId) return NextResponse.json({ error: 'Missing mainAccountId' }, { status: 400 });
    await requireMainAccountAccess(mainAccountId);
    await deleteCoyoBacklogTaskForAccount(mainAccountId, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error, 'Unable to delete the Coyô task. Please try again.');
  }
}
