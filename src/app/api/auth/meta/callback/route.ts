import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMetaAuthConfig } from '@/lib/metaAuth';
import { authzErrorResponse, requireAdmin } from '@/lib/authz';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const mainAccountId = url.searchParams.get('state');

  if (!code || !mainAccountId) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  try {
    await requireAdmin();
    const { appId, appSecret, redirectUri } = getMetaAuthConfig(url.origin);

    // 1. Exchange code for short-lived access token
    const tokenResponse = await fetch(`https://graph.facebook.com/v25.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`);
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Meta Token Exchange Error:', tokenData);
      throw new Error(tokenData.error?.message || 'Failed to exchange token');
    }

    const shortLivedToken = tokenData.access_token;

    // 2. Exchange short-lived token for long-lived token
    const longLivedResponse = await fetch(`https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`);
    const longLivedData = await longLivedResponse.json();

    if (!longLivedResponse.ok) {
      console.error('Meta Long Lived Token Error:', longLivedData);
      throw new Error(longLivedData.error?.message || 'Failed to get long-lived token');
    }

    const longLivedToken = longLivedData.access_token;
    // expires_in is usually around 60 days
    const expiresIn = longLivedData.expires_in;
    const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : null;

    await prisma.metaCredential.upsert({
      where: { mainAccountId },
      update: {
        accessToken: shortLivedToken,
        longLivedToken: longLivedToken,
        expiresAt: expiresAt,
      },
      create: {
        mainAccountId,
        accessToken: shortLivedToken,
        longLivedToken: longLivedToken,
        expiresAt: expiresAt,
      }
    });

    return NextResponse.redirect(new URL(`/settings?success=meta_linked`, request.url));
  } catch (error) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('Error in Meta OAuth callback', error);
    return NextResponse.redirect(new URL('/settings?error=meta_link_failed', request.url));
  }
}
