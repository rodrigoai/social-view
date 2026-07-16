import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMetaAccessToken, isMetaAuthError } from '@/lib/metaAuth';
import { authzErrorResponse, requireMainAccountAccess } from '@/lib/authz';
import { syncInstagramFollowers } from '@/lib/instagramFollowers';

export async function GET(request: Request) {
  const mainAccountId = new URL(request.url).searchParams.get('mainAccountId');

  if (!mainAccountId) {
    return NextResponse.json({ error: 'Missing mainAccountId' }, { status: 400 });
  }

  try {
    await requireMainAccountAccess(mainAccountId);
    const accessToken = await getMetaAccessToken(mainAccountId);
    const configs = await prisma.instagramPageConfig.findMany({ where: { mainAccountId } });
    const accounts = [];

    for (const config of configs) {
      try {
        const synced = await syncInstagramFollowers(config, accessToken);
        accounts.push({
          igAccountId: config.igAccountId,
          igAccountName: config.igAccountName,
          username: synced.accountInfo.username || config.igAccountName,
          followers: synced.followers,
          followersHistory: synced.followersHistory
        });
      } catch (error) {
        if (isMetaAuthError(error)) throw error;
        console.error(`Error refreshing IG followers for ${config.igAccountId}`, error);
      }
    }

    return NextResponse.json(
      { accounts },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: any) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('Instagram Followers Refresh Error:', error);
    if (isMetaAuthError(error)) {
      return NextResponse.json(
        { code: 'AUTH_REQUIRED', message: 'Meta authentication failed' },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
