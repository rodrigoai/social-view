import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mainAccountId = url.searchParams.get('mainAccountId');
  // period and date filters would normally be passed to the API here
  // For FB page insights, we fetch page fans and engagement

  if (!mainAccountId) {
    return NextResponse.json({ error: 'Missing mainAccountId' }, { status: 400 });
  }

  try {
    const configs = await prisma.facebookPageConfig.findMany({ where: { mainAccountId } });
    if (!configs || configs.length === 0) {
      return NextResponse.json({ pages: [] });
    }

    const pagesData = [];

    for (const config of configs) {
      if (!config.accessToken) continue;

      // Basic page insights: page_impressions, page_post_engagements
      const since = new Date();
      since.setDate(since.getDate() - 30); // fixed to 30d for simplicity or we can pass period
      const sinceStr = since.toISOString().split('T')[0];
      const untilStr = new Date().toISOString().split('T')[0];

      try {
        const res = await fetch(`https://graph.facebook.com/v25.0/${config.pageId}/insights?metric=page_impressions,page_post_engagements&since=${sinceStr}&until=${untilStr}&access_token=${config.accessToken}`);
        const data = await res.json();

        if (data.error) {
          console.error(`FB Insights Error for ${config.pageId}:`, data.error.message);
          continue;
        }

        let impressions = 0;
        let engagement = 0;

        if (data.data) {
          const impMetric = data.data.find((m: any) => m.name === 'page_impressions');
          const engMetric = data.data.find((m: any) => m.name === 'page_post_engagements');
          
          if (impMetric && impMetric.values) {
            impressions = impMetric.values.reduce((sum: number, val: any) => sum + (val.value || 0), 0);
          }
          if (engMetric && engMetric.values) {
            engagement = engMetric.values.reduce((sum: number, val: any) => sum + (val.value || 0), 0);
          }
        }

        pagesData.push({
          pageId: config.pageId,
          pageName: config.pageName,
          stats: {
            impressions,
            engagement
          }
        });

      } catch (err) {
        console.error(`Error fetching FB insights for ${config.pageId}`, err);
      }
    }

    return NextResponse.json({ pages: pagesData });
  } catch (error: any) {
    console.error('Facebook Pages Dashboard Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
