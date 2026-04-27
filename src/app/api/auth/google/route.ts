import { NextResponse } from 'next/server';
import { getGoogleOAuthClient } from '@/lib/googleAuth';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mainAccountId = url.searchParams.get('mainAccountId');
  
  if (!mainAccountId) {
    return NextResponse.json({ error: 'mainAccountId is required' }, { status: 400 });
  }

  const client = getGoogleOAuthClient();
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/adwords',
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/webmasters.readonly'
    ],
    state: mainAccountId,
    prompt: 'consent',
  });

  return NextResponse.redirect(authUrl);
}
