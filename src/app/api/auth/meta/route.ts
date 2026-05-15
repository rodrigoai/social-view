import { NextResponse } from 'next/server';
import { getMetaAuthConfig } from '@/lib/metaAuth';
import { authzErrorResponse, requireAdmin } from '@/lib/authz';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mainAccountId = url.searchParams.get('mainAccountId');
  
  if (!mainAccountId) {
    return NextResponse.json({ error: 'mainAccountId is required' }, { status: 400 });
  }

  try {
    await requireAdmin();
    const { appId, redirectUri } = getMetaAuthConfig(url.origin);
    const scope = [
      'ads_read',
      'read_insights',
      'pages_show_list',
      'pages_read_engagement',
      'instagram_basic',
      'instagram_manage_insights'
    ].join(',');

    const authUrl = `https://www.facebook.com/v25.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${mainAccountId}&scope=${scope}`;

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
