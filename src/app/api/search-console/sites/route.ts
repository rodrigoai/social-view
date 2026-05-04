import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthorizedClient } from '@/lib/googleAuth';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mainAccountId = url.searchParams.get('mainAccountId');

  if (!mainAccountId) {
    return NextResponse.json({ error: 'mainAccountId is required' }, { status: 400 });
  }

  try {
    const { withGoogleAuth } = await import('@/lib/googleAuth');

    return await withGoogleAuth(mainAccountId, async (authClient) => {
      const searchconsole = google.searchconsole({ version: 'v1', auth: authClient });
      
      const response = await searchconsole.sites.list();
      const siteEntryList = response.data.siteEntry || [];

      // Filter for verified sites or just return all
      const sites = siteEntryList.map(site => ({
        siteUrl: site.siteUrl,
        permissionLevel: site.permissionLevel
      }));

      return NextResponse.json({ sites });
    });
  } catch (error: any) {
    console.error('Failed to fetch Search Console sites:', error);
    
    const authErrors = ['NOT_CONFIGURED', 'REFRESH_FAILED', 'REFRESH_TOKEN_MISSING'];
    if (authErrors.includes(error.message) || error.code === 401 || (error.response && error.response.status === 401)) {
      return NextResponse.json({ 
        error: 'Google Search Console authentication failed', 
        code: 'AUTH_REQUIRED',
        details: error.message 
      }, { status: 401 });
    }

    return NextResponse.json({ 
      error: 'Failed to fetch sites', 
      details: error.message,
    }, { status: 500 });
  }
}
