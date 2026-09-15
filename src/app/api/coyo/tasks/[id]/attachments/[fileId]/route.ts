import { authzErrorResponse, requireMainAccountAccess } from '@/lib/authz';
import { CoyoTasksError, removeCoyoBacklogAttachmentForAccount } from '@/lib/coyoTasksServer';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const { id, fileId } = await params;
    const mainAccountId = new URL(request.url).searchParams.get('mainAccountId')?.trim() || '';
    if (!mainAccountId) return Response.json({ error: 'Missing mainAccountId' }, { status: 400 });
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(fileId)) return Response.json({ error: 'Invalid attachment.' }, { status: 400 });
    await requireMainAccountAccess(mainAccountId);
    const task = await removeCoyoBacklogAttachmentForAccount(mainAccountId, id, fileId);
    return Response.json({ task }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return authzErrorResponse(error)
      || (error instanceof CoyoTasksError ? Response.json({ error: error.message }, { status: error.status }) : null)
      || Response.json({ error: 'Unable to remove the attachment. Please try again.' }, { status: 502 });
  }
}
