import { NextResponse } from 'next/server';
import { createMetaApiError, getMetaAccessToken, isMetaAuthError } from '@/lib/metaAuth';
import { authzErrorResponse, requireAdmin } from '@/lib/authz';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mainAccountId = url.searchParams.get('mainAccountId');

  if (!mainAccountId) {
    return NextResponse.json({ error: 'Missing mainAccountId' }, { status: 400 });
  }

  try {
    await requireAdmin();
    const accessToken = await getMetaAccessToken(mainAccountId);

    const res = await fetch(`https://graph.facebook.com/v25.0/me/accounts?fields=name,access_token,id&access_token=${accessToken}`);
    const data = await res.json();

    if (!res.ok) {
      throw createMetaApiError(data, 'Failed to fetch Facebook pages');
    }

    const accounts = data.data.map((page: any) => ({
      id: page.id,
      name: page.name,
      accessToken: page.access_token
    }));

    return NextResponse.json({ accounts });
  } catch (error: any) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('Facebook Pages Accounts Error:', error);
    if (isMetaAuthError(error)) {
      return NextResponse.json({ code: 'AUTH_REQUIRED', message: 'Meta authentication failed' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
