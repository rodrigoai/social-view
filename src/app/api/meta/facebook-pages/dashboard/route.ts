import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
    const configs = await prisma.facebookPageConfig.findMany({ where: { mainAccountId } });
    if (!configs || configs.length === 0) {
      return NextResponse.json({ pages: [] });
    }

    const pagesData = [];

    let sinceTs: number;
    let untilTs: number;

    const nowTs = Math.floor(Date.now() / 1000);

    if (startDate && endDate) {
      sinceTs = Math.floor(new Date(startDate).getTime() / 1000);
      untilTs = Math.min(Math.floor(new Date(endDate).getTime() / 1000) + 86400, nowTs);
    } else {
      const days = parseInt(period.replace('d', '')) || 30;
      const since = new Date();
      since.setDate(since.getDate() - days);
      sinceTs = Math.floor(since.getTime() / 1000);
      untilTs = nowTs;
    }

    for (const config of configs) {
      if (!config.accessToken) continue;
      const pageAccessToken = config.accessToken;

      try {
        // 1. Fetch Page Info (Fans/Followers)
        const pageInfoRes = await fetch(`https://graph.facebook.com/v25.0/${config.pageId}?fields=fan_count,followers_count,name&access_token=${config.accessToken}`);
        const pageInfo = await pageInfoRes.json();

        // 2. Fetch Insights (Chunked for robustness)
        let impressions = 0;
        let engagement = 0;

        const fetchFbInChunks = async (metric: string) => {
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
                access_token: pageAccessToken
              });
              const insightsRes = await fetch(`https://graph.facebook.com/v25.0/${config.pageId}/insights?${params.toString()}`);
              const insightsData = await insightsRes.json();
              
              if (insightsData.data && insightsData.data[0]) {
                total += sumInsightValue(insightsData.data[0]);
              } else if (insightsData.error) {
                console.error(`[FB DEBUG] Chunk Error for ${metric} (${currentSince}-${nextUntil}):`, JSON.stringify(insightsData.error));
              } else {
                console.log(`[FB DEBUG] No data for ${metric} (${currentSince}-${nextUntil})`);
              }
            } catch (e) {
              console.error(`Error in FB chunked fetch for ${metric}:`, e);
            }
            currentSince = nextUntil;
            if (currentSince >= untilTs) break;
          }
          return total;
        };

        impressions = await fetchFbInChunks('page_media_view');
        const reach = await fetchFbInChunks('page_total_media_view_unique');
        engagement = await fetchFbInChunks('page_post_engagements');

        // 3. Fetch Posts for Top Content
        const postsRes = await fetch(`https://graph.facebook.com/v25.0/${config.pageId}/posts?fields=id,message,created_time,shares,likes.summary(true),comments.summary(true),attachments{media,target,type,url}&limit=100&access_token=${config.accessToken}`);
        const postsData = await postsRes.json();

        // Process Posts
        let topPosts = [];
        let totalEngagement = 0;
        if (postsData.data) {
          const processedPosts = postsData.data
            .map((p: any) => {
              const likes = p.likes?.summary?.total_count || 0;
              const comments = p.comments?.summary?.total_count || 0;
              const shares = p.shares?.count || 0;
              const postEngagement = likes + comments + shares;
              
              return {
                id: p.id,
                message: p.message,
                createdTime: p.created_time,
                likes,
                comments,
                shares,
                engagement: postEngagement,
                permalink: `https://facebook.com/${p.id}`,
                thumbnail: p.attachments?.data?.[0]?.media?.image?.src || null
              };
            })
            .filter((p: any) => {
              const postTs = Math.floor(new Date(p.createdTime).getTime() / 1000);
              return postTs >= sinceTs && postTs <= untilTs;
            });

          totalEngagement = engagement || processedPosts.reduce((sum: number, p: any) => sum + p.engagement, 0);
          topPosts = processedPosts
            .sort((a: any, b: any) => b.engagement - a.engagement)
            .slice(0, 10);
        } else {
          totalEngagement = engagement;
        }

        pagesData.push({
          pageId: config.pageId,
          pageName: pageInfo.name || config.pageName,
          fans: pageInfo.fan_count || 0,
          followers: pageInfo.followers_count || 0,
          stats: {
            impressions,
            reach,
            engagement: totalEngagement
          },
          topPosts
        });

      } catch (err) {
        console.error(`Error fetching FB data for ${config.pageId}`, err);
      }
    }

    return NextResponse.json({ pages: pagesData });
  } catch (error: any) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('Facebook Pages Dashboard Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
