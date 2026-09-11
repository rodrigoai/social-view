import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authzErrorResponse, requireMainAccountAccess } from '@/lib/authz';
import type { CoyoTask } from '@/lib/coyoTasks';

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('mainAccountId');
  if (!id) return NextResponse.json({ error: 'Missing mainAccountId' }, { status: 400 });
  try {
    await requireMainAccountAccess(id);
    const account = await prisma.mainAccount.findUnique({ where: { id }, select: { coyoClientAcronym: true, coyoTaskManagerKey: true } });
    if (!account?.coyoClientAcronym) return NextResponse.json({ error: 'Configure this customer’s Coyô client prefix in Settings.' }, { status: 400 });
    const token = account.coyoTaskManagerKey;
    const origin = process.env.COYO_EXTERNAL_API_ORIGIN;
    if (!token || !origin) return NextResponse.json({ error: 'Coyô API token and registered Origin must be configured on the server.' }, { status: 503 });
    const url = new URL('https://taskmanager.coyo.com.br/api/external/tasks');
    url.searchParams.set('clientAcronym', account.coyoClientAcronym);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Origin: origin, Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (!response.ok) return NextResponse.json({ error: response.status === 403 ? 'Coyô rejected the registered Origin. Check the server configuration.' : response.status === 401 ? 'Coyô rejected the API token.' : response.status === 400 ? 'Coyô rejected the customer prefix. Check Settings.' : 'Coyô TaskManager is unavailable. Please try again.' }, { status: 502 });
    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error('Invalid response');
    const tasks = payload.filter((task: CoyoTask) => task.client?.prefix?.toLowerCase() === account.coyoClientAcronym!.toLowerCase());
    return NextResponse.json({ tasks }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return authzErrorResponse(error) || NextResponse.json({ error: 'Unable to load Coyô tasks. Please try again.' }, { status: 502 });
  }
}
