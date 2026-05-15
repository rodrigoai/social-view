import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authzErrorResponse, requireMainAccountAccess } from '@/lib/authz';

const PAGESPEED_ENDPOINT = 'https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed';

const CATEGORIES = [
  { key: 'performance', label: 'Desempenho' },
  { key: 'accessibility', label: 'Acessibilidade' },
  { key: 'best-practices', label: 'Práticas recomendadas' },
  { key: 'seo', label: 'SEO' }
] as const;

const STRATEGIES = ['mobile', 'desktop'] as const;

function normalizeWebsiteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function toScore(value: unknown) {
  return typeof value === 'number' ? Math.round(value * 100) : null;
}

async function fetchPageSpeedScores(websiteUrl: string, strategy: typeof STRATEGIES[number]) {
  const params = new URLSearchParams({
    url: websiteUrl,
    strategy,
    locale: 'pt-BR'
  });
  CATEGORIES.forEach((category) => params.append('category', category.key));
  if (process.env.GOOGLE_PAGESPEED_API_KEY) {
    params.set('key', process.env.GOOGLE_PAGESPEED_API_KEY);
  }

  const response = await fetch(`${PAGESPEED_ENDPOINT}?${params.toString()}`);
  const payload = await response.json();

  if (!response.ok) {
    return {
      strategy,
      error: payload?.error?.message || 'Failed to fetch PageSpeed Insights data',
      status: response.status
    };
  }

  const lighthouseCategories = payload?.lighthouseResult?.categories || {};
  return {
    strategy,
    finalUrl: payload?.lighthouseResult?.finalUrl || payload?.id || websiteUrl,
    fetchedAt: payload?.analysisUTCTimestamp || payload?.lighthouseResult?.fetchTime || null,
    scores: CATEGORIES.map((category) => ({
      key: category.key,
      label: category.label,
      score: toScore(lighthouseCategories[category.key]?.score)
    }))
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mainAccountId = url.searchParams.get('mainAccountId');

  if (!mainAccountId) {
    return NextResponse.json({ error: 'mainAccountId is required' }, { status: 400 });
  }

  try {
    await requireMainAccountAccess(mainAccountId);
    const account = await prisma.mainAccount.findUnique({
      where: { id: mainAccountId },
      select: { mainWebsiteUrl: true }
    });
    const websiteUrl = account?.mainWebsiteUrl ? normalizeWebsiteUrl(account.mainWebsiteUrl) : null;

    if (!websiteUrl) {
      return NextResponse.json({
        configured: false,
        url: null,
        scores: []
      });
    }

    const [mobile, desktop] = await Promise.all(
      STRATEGIES.map((strategy) => fetchPageSpeedScores(websiteUrl, strategy))
    );

    const failedResult = [mobile, desktop].find((result) => 'error' in result);
    if (failedResult && 'error' in failedResult) {
      return NextResponse.json({ error: failedResult.error }, { status: failedResult.status });
    }

    return NextResponse.json({
      configured: true,
      url: websiteUrl,
      finalUrl: mobile.finalUrl || desktop.finalUrl || websiteUrl,
      fetchedAt: mobile.fetchedAt || desktop.fetchedAt || null,
      strategies: {
        mobile,
        desktop
      },
      scores: mobile.scores
    });
  } catch (error: any) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('PageSpeed Dashboard Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
