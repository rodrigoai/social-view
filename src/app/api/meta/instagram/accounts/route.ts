import { NextResponse } from 'next/server';
import { createMetaApiError, getMetaAccessToken, isMetaAuthError } from '@/lib/metaAuth';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mainAccountId = url.searchParams.get('mainAccountId');

  if (!mainAccountId) {
    return NextResponse.json({ error: 'Missing mainAccountId' }, { status: 400 });
  }

  try {
    const accessToken = await getMetaAccessToken(mainAccountId);

    const res = await fetch(`https://graph.facebook.com/v25.0/me/accounts?fields=instagram_business_account{id,username},name&access_token=${accessToken}`);
    const data = await res.json();

    if (!res.ok) {
      throw createMetaApiError(data, 'Failed to fetch Instagram accounts');
    }

    const accounts: any[] = [];
    data.data.forEach((page: any) => {
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
    console.error('Instagram Accounts Error:', error);
    if (isMetaAuthError(error)) {
      return NextResponse.json({ code: 'AUTH_REQUIRED', message: 'Meta authentication failed' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
