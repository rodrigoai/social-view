import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mainAccountId = url.searchParams.get('mainAccountId');
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const period = url.searchParams.get('period') || '30d';

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

    const configs = await prisma.instagramPageConfig.findMany({ where: { mainAccountId } });
    if (!configs || configs.length === 0) {
      return NextResponse.json({ accounts: [] });
    }

    const igData = [];

    let sinceTs: number;
    let untilTs: number;

    const nowTs = Math.floor(Date.now() / 1000);

    if (startDate && endDate) {
      sinceTs = Math.floor(new Date(startDate).getTime() / 1000);
      // Ensure until is not in the future
      untilTs = Math.min(Math.floor(new Date(endDate).getTime() / 1000) + 86400, nowTs);
    } else {
      const days = parseInt(period.replace('d', '')) || 30;
      const since = new Date();
      since.setDate(since.getDate() - days);
      sinceTs = Math.floor(since.getTime() / 1000);
      untilTs = nowTs;
    }

    for (const config of configs) {
      try {
        // 1. Fetch Account Info (Followers)
        const accountRes = await fetch(`https://graph.facebook.com/v25.0/${config.igAccountId}?fields=followers_count,media_count,username&access_token=${cred.longLivedToken}`);
        const accountInfo = await accountRes.json();

        // 2. Fetch Insights (Fetch in 30-day chunks because IG has a limit)
        const metricsToFetch = ['reach', 'views'];
        let reach = 0;
        let profileViews = 0; // Deprecated in v25.0, will remain 0
        let views = 0;

        // Function to fetch in chunks
        const fetchInChunks = async (metric: string) => {
          let total = 0;
          let currentSince = sinceTs;
          const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;

          while (currentSince < untilTs) {
            const nextUntil = Math.min(currentSince + THIRTY_DAYS_SEC, untilTs);
            try {
              const insightsRes = await fetch(`https://graph.facebook.com/v25.0/${config.igAccountId}/insights?metric=${metric}&period=day&since=${currentSince}&until=${nextUntil}&access_token=${cred.longLivedToken}`);
              const insightsData = await insightsRes.json();
              
              if (insightsData.data && insightsData.data[0]) {
                total += insightsData.data[0].values.reduce((sum: number, val: any) => sum + (val.value || 0), 0);
              } else if (insightsData.error) {
                console.error(`[IG DEBUG] Chunk Error for ${metric} (${currentSince}-${nextUntil}):`, JSON.stringify(insightsData.error));
              }
            } catch (e) {
              console.error(`Error in chunked fetch for ${metric}:`, e);
            }
            currentSince = nextUntil;
            if (currentSince >= untilTs) break;
          }
          return total;
        };

        reach = await fetchInChunks('reach');
        views = await fetchInChunks('views');

        // 3. Fetch Media for Top Content
        const mediaRes = await fetch(`https://graph.facebook.com/v25.0/${config.igAccountId}/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count&limit=50&access_token=${cred.longLivedToken}`);
        const mediaData = await mediaRes.json();
        let topMedia = [];
        if (mediaData.data) {
          topMedia = mediaData.data
            .map((m: any) => ({
              id: m.id,
              caption: m.caption,
              type: m.media_type,
              url: m.media_url,
              permalink: m.permalink,
              thumbnail: m.thumbnail_url || m.media_url,
              timestamp: m.timestamp,
              likes: m.like_count || 0,
              comments: m.comments_count || 0,
              engagement: (m.like_count || 0) + (m.comments_count || 0)
            }))
            // Filter by date range if possible
            .filter((m: any) => {
              const postTs = Math.floor(new Date(m.timestamp).getTime() / 1000);
              return postTs >= sinceTs && postTs <= untilTs;
            })
            .sort((a: any, b: any) => b.engagement - a.engagement)
            .slice(0, 10);
        }

        igData.push({
          igAccountId: config.igAccountId,
          igAccountName: config.igAccountName,
          username: accountInfo.username || config.igAccountName,
          followers: accountInfo.followers_count || 0,
          mediaCount: accountInfo.media_count || 0,
          stats: {
            impressions: views,
            reach,
            profileViews
          },
          topMedia
        });

      } catch (err) {
        console.error(`Error fetching IG data for ${config.igAccountId}`, err);
      }
    }

    return NextResponse.json({ accounts: igData });
  } catch (error: any) {
    console.error('Instagram Dashboard Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
