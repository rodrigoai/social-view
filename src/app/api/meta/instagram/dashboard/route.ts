import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mainAccountId = url.searchParams.get('mainAccountId');

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

    for (const config of configs) {
      // metric options: impressions, reach, profile_views
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const sinceStr = since.toISOString().split('T')[0];
      const untilStr = new Date().toISOString().split('T')[0];

      try {
        const res = await fetch(`https://graph.facebook.com/v25.0/${config.igAccountId}/insights?metric=impressions,reach,profile_views&period=day&since=${sinceStr}&until=${untilStr}&access_token=${cred.longLivedToken}`);
        const data = await res.json();

        if (data.error) {
          console.error(`IG Insights Error for ${config.igAccountId}:`, data.error.message);
          continue;
        }

        let impressions = 0;
        let reach = 0;
        let profileViews = 0;

        if (data.data) {
          const impMetric = data.data.find((m: any) => m.name === 'impressions');
          const reachMetric = data.data.find((m: any) => m.name === 'reach');
          const pvMetric = data.data.find((m: any) => m.name === 'profile_views');
          
          if (impMetric && impMetric.values) {
            impressions = impMetric.values.reduce((sum: number, val: any) => sum + (val.value || 0), 0);
          }
          if (reachMetric && reachMetric.values) {
            reach = reachMetric.values.reduce((sum: number, val: any) => sum + (val.value || 0), 0);
          }
          if (pvMetric && pvMetric.values) {
            profileViews = pvMetric.values.reduce((sum: number, val: any) => sum + (val.value || 0), 0);
          }
        }

        igData.push({
          igAccountId: config.igAccountId,
          igAccountName: config.igAccountName,
          stats: {
            impressions,
            reach,
            profileViews
          }
        });

      } catch (err) {
        console.error(`Error fetching IG insights for ${config.igAccountId}`, err);
      }
    }

    return NextResponse.json({ accounts: igData });
  } catch (error: any) {
    console.error('Instagram Dashboard Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
