import { NextResponse } from 'next/server';
import { authzErrorResponse, requireMainAccountAccess } from '@/lib/authz';
import { CoyoTasksError, deleteCoyoBacklogTaskForAccount, updateCoyoBacklogTaskForAccount, type UpdateCoyoTaskInput } from '@/lib/coyoTasksServer';

function errorResponse(error: unknown, fallback: string) {
  return authzErrorResponse(error)
    || (error instanceof CoyoTasksError ? NextResponse.json({ error: error.message }, { status: error.status }) : null)
    || NextResponse.json({ error: fallback }, { status: 502 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const mainAccountId = typeof body.mainAccountId === 'string' ? body.mainAccountId.trim() : '';
    if (!mainAccountId) return NextResponse.json({ error: 'Missing mainAccountId' }, { status: 400 });
    await requireMainAccountAccess(mainAccountId);

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const dueDate = body.dueDate === null || body.dueDate === '' ? null : typeof body.dueDate === 'string' ? body.dueDate.trim() : '';
    const workspace = typeof body.workspace === 'string' ? body.workspace.toUpperCase() : '';
    if (!title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    if (title.length > 240) return NextResponse.json({ error: 'Title must be 240 characters or fewer.' }, { status: 400 });
    if (dueDate && Number.isNaN(Date.parse(dueDate))) return NextResponse.json({ error: 'Due date must be a valid ISO date.' }, { status: 400 });
    if (workspace !== 'AGENCY' && workspace !== 'SOFTWARE') return NextResponse.json({ error: 'Workspace must be AGENCY or SOFTWARE.' }, { status: 400 });

    const input: UpdateCoyoTaskInput = { title, description, dueDate, workspace };
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
