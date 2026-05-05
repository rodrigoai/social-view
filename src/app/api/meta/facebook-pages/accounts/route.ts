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

    const res = await fetch(`https://graph.facebook.com/v25.0/me/accounts?fields=name,access_token,id&access_token=${cred.longLivedToken}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message || 'Failed to fetch Facebook pages');
    }

    const accounts = data.data.map((page: any) => ({
      id: page.id,
      name: page.name,
      accessToken: page.access_token
    }));

    return NextResponse.json({ accounts });
  } catch (error: any) {
    console.error('Facebook Pages Accounts Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
