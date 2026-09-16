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

    const endpoint = new URL('https://graph.facebook.com/v25.0/me/accounts');
    endpoint.searchParams.set('fields', 'instagram_business_account{id,username},name');
    endpoint.searchParams.set('limit', '100');
    endpoint.searchParams.set('access_token', accessToken);
    const data = await fetchAllMetaConnectionPages<any>(endpoint, 'Failed to fetch Instagram accounts');

    const accounts: any[] = [];
    data.forEach((page: any) => {
      if (page.instagram_business_account) {
        accounts.push({
          id: page.instagram_business_account.id,
          name: page.instagram_business_account.username || `IG Account ${page.instagram_business_account.id}`,
          facebookPageId: page.id
        });
      }
    });

    return NextResponse.json({ accounts });
  } catch (error: any) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('Instagram Accounts Error:', error);
    if (isMetaAuthError(error)) {
      return NextResponse.json({ code: 'AUTH_REQUIRED', message: 'Meta authentication failed' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
