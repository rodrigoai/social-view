import { NextResponse } from 'next/server';
import { getMetaAccessToken, isMetaAuthError } from '@/lib/metaAuth';
import { authzErrorResponse, requireAdmin } from '@/lib/authz';
import { fetchAllMetaConnectionPages } from '@/lib/metaGraph';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mainAccountId = url.searchParams.get('mainAccountId');

  if (!mainAccountId) {
    return NextResponse.json({ error: 'Missing mainAccountId' }, { status: 400 });
  }

  try {
    await requireAdmin();
    const accessToken = await getMetaAccessToken(mainAccountId);

    const endpoint = new URL('https://graph.facebook.com/v25.0/me/adaccounts');
    endpoint.searchParams.set('fields', 'name,account_id,currency,account_status');
    endpoint.searchParams.set('limit', '100');
    endpoint.searchParams.set('access_token', accessToken);
    const data = await fetchAllMetaConnectionPages<any>(endpoint, 'Failed to fetch ad accounts');

    const accounts = data.map((acc: any) => ({
      id: acc.account_id, // e.g. "act_123456789" is usually just the ID but often returned with act_ prefix or without, account_id is numeric.
      actId: `act_${acc.account_id}`,
      name: acc.name || `Account ${acc.account_id}`,
      currency: acc.currency || null,
      accountStatus: acc.account_status ?? null,
    }));

    return NextResponse.json({ accounts });
  } catch (error: any) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('Meta Ads Accounts Error:', error);
    if (isMetaAuthError(error)) {
      return NextResponse.json({ code: 'AUTH_REQUIRED', message: 'Meta authentication failed' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
