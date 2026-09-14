import { NextResponse } from 'next/server';
import { authzErrorResponse, requireMainAccountAccess } from '@/lib/authz';
import { CoyoTasksError, fetchCoyoTasksForAccount } from '@/lib/coyoTasksServer';

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
