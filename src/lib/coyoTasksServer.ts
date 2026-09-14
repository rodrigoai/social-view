import { prisma } from '@/lib/prisma';
import type { CoyoTask } from '@/lib/coyoTasks';

export class CoyoTasksError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function fetchCoyoTasksForAccount(mainAccountId: string) {
  const account = await prisma.mainAccount.findUnique({
    where: { id: mainAccountId },
    select: { coyoClientAcronym: true, coyoTaskManagerKey: true },
  });
  if (!account?.coyoClientAcronym) throw new CoyoTasksError('Configure this customer’s Coyô client prefix in Settings.', 400);
  const token = account.coyoTaskManagerKey;
  const origin = process.env.COYO_EXTERNAL_API_ORIGIN;
  if (!token || !origin) throw new CoyoTasksError('Coyô API token and registered Origin must be configured on the server.', 503);

  const url = new URL('https://taskmanager.coyo.com.br/api/external/tasks');
  url.searchParams.set('clientAcronym', account.coyoClientAcronym);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Origin: origin, Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const message = response.status === 403 ? 'Coyô rejected the registered Origin. Check the server configuration.'
      : response.status === 401 ? 'Coyô rejected the API token.'
      : response.status === 400 ? 'Coyô rejected the customer prefix. Check Settings.'
      : 'Coyô TaskManager is unavailable. Please try again.';
    throw new CoyoTasksError(message, 502);
  }
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new CoyoTasksError('Coyô returned an invalid task response.', 502);
  return payload.filter((task: CoyoTask) => task.client?.prefix?.toLowerCase() === account.coyoClientAcronym!.toLowerCase()) as CoyoTask[];
}
