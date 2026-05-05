import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mainAccountId = url.searchParams.get('mainAccountId');

  if (!mainAccountId) {
    return NextResponse.json({ error: 'Missing mainAccountId' }, { status: 400 });
  }

  try {
    const cred = await prisma.metaCredential.findUnique({
      where: { mainAccountId }
    });

    if (!cred || !cred.longLivedToken) {
      return NextResponse.json({ code: 'AUTH_REQUIRED', message: 'Meta account not linked' }, { status: 401 });
    }

    const res = await fetch(`https://graph.facebook.com/v25.0/me/accounts?fields=instagram_business_account{id,username},name&access_token=${cred.longLivedToken}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message || 'Failed to fetch Instagram accounts');
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
