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

    const res = await fetch(`https://graph.facebook.com/v25.0/me/adaccounts?fields=name,account_id&access_token=${cred.longLivedToken}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message || 'Failed to fetch ad accounts');
    }

    // data.data contains the ad accounts
    const accounts = data.data.map((acc: any) => ({
      id: acc.account_id, // e.g. "act_123456789" is usually just the ID but often returned with act_ prefix or without, account_id is numeric.
      name: acc.name || `Account ${acc.account_id}`
    }));

    return NextResponse.json({ accounts });
  } catch (error: any) {
    console.error('Meta Ads Accounts Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
