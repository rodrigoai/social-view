import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createMetaApiError, getMetaAccessToken, isMetaAuthError } from '@/lib/metaAuth';
import { authzErrorResponse, requireMainAccountAccess } from '@/lib/authz';

function sumInsightValue(metricData: any) {
  if (!metricData) return 0;

  if (Array.isArray(metricData.values)) {
    return metricData.values.reduce((sum: number, val: any) => {
      const value = val?.value;
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
  }

  const totalValue = metricData.total_value?.value;
  return typeof totalValue === 'number' ? totalValue : 0;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

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
    await requireMainAccountAccess(mainAccountId);
    const accessToken = await getMetaAccessToken(mainAccountId);

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
        const accountRes = await fetch(`https://graph.facebook.com/v25.0/${config.igAccountId}?fields=followers_count,media_count,username&access_token=${accessToken}`);
        const accountInfo = await accountRes.json();
        if (!accountRes.ok) {
          throw createMetaApiError(accountInfo, 'Failed to fetch Instagram account info');
        }
        const followers = accountInfo.followers_count || 0;
        const today = startOfDay(new Date());

        await prisma.instagramFollowersHistory.upsert({
          where: {
            igAccountId_date: {
              igAccountId: config.igAccountId,
              date: today
            }
          },
          update: {
            followersCount: followers
          },
          create: {
            igAccountId: config.igAccountId,
            date: today,
            followersCount: followers
          }
        });

        const historyStartDate = startOfDay(new Date(today));
        historyStartDate.setDate(historyStartDate.getDate() - 89);
        const followersHistory = await prisma.instagramFollowersHistory.findMany({
          where: {
            igAccountId: config.igAccountId,
            date: {
              gte: historyStartDate
            }
          },
          orderBy: {
            date: 'asc'
          }
        });

        // 2. Fetch Insights (Fetch in 30-day chunks because IG has a limit)
        let reach = 0;
        let profileViews = 0;
        let views = 0;

        // Function to fetch in chunks
        const fetchInChunks = async (metric: string, metricType?: 'total_value') => {
          let total = 0;
          let currentSince = sinceTs;
          const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;

          while (currentSince < untilTs) {
            const nextUntil = Math.min(currentSince + THIRTY_DAYS_SEC, untilTs);
            try {
              const params = new URLSearchParams({
                metric,
                period: 'day',
                since: String(currentSince),
                until: String(nextUntil),
                access_token: accessToken
              });
              if (metricType) {
                params.set('metric_type', metricType);
              }
              const insightsRes = await fetch(`https://graph.facebook.com/v25.0/${config.igAccountId}/insights?${params.toString()}`);
              const insightsData = await insightsRes.json();
              if (!insightsRes.ok) {
                throw createMetaApiError(insightsData, `Failed to fetch Instagram ${metric} insights`);
              }
              
              if (insightsData.data && insightsData.data[0]) {
                total += sumInsightValue(insightsData.data[0]);
              }
            } catch (e) {
              console.error(`Error in chunked fetch for ${metric}:`, e);
              if (isMetaAuthError(e)) {
                throw e;
              }
            }
            currentSince = nextUntil;
            if (currentSince >= untilTs) break;
          }
          return total;
        };

        reach = await fetchInChunks('reach');
        views = await fetchInChunks('views', 'total_value');
        profileViews = await fetchInChunks('profile_views', 'total_value');

        // 3. Fetch Media for Top Content
        const mediaRes = await fetch(`https://graph.facebook.com/v25.0/${config.igAccountId}/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count&limit=50&access_token=${accessToken}`);
        const mediaData = await mediaRes.json();
        if (!mediaRes.ok) {
          throw createMetaApiError(mediaData, 'Failed to fetch Instagram media');
        }
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
          followers,
          mediaCount: accountInfo.media_count || 0,
          stats: {
            impressions: views,
            reach,
            profileViews
          },
          followersHistory: followersHistory.map((entry) => ({
            date: entry.date.toISOString().slice(0, 10),
            followers: entry.followersCount
          })),
          topMedia
        });

      } catch (err) {
        console.error(`Error fetching IG data for ${config.igAccountId}`, err);
      }
    }

    return NextResponse.json({ accounts: igData });
  } catch (error: any) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('Instagram Dashboard Error:', error);
    if (isMetaAuthError(error)) {
      return NextResponse.json({ code: 'AUTH_REQUIRED', message: 'Meta authentication failed' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
