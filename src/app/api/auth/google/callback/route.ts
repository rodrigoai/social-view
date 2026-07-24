import { NextResponse } from 'next/server';
import { getGoogleOAuthClient } from '@/lib/googleAuth';
import { prisma } from '@/lib/prisma';
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
    const redirectUri = new URL('/api/auth/google/callback', request.url).toString();
    const client = getGoogleOAuthClient(redirectUri);
    const { tokens } = await client.getToken(code);
    
    const updateData: any = {
      accessToken: tokens.access_token,
      expiresAt: tokens.expiry_date,
    };
    
    if (tokens.refresh_token) {
      updateData.refreshToken = tokens.refresh_token;
    }
    
    await prisma.googleCredential.upsert({
      where: { mainAccountId },
      update: updateData,
      create: {
        mainAccountId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expiry_date,
      }
    });


    return NextResponse.redirect(new URL(`/settings?success=google_linked`, request.url));
  } catch (error) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('Error in Google OAuth callback', error);
    return NextResponse.redirect(new URL('/settings?error=google_link_failed', request.url));
  }
}
