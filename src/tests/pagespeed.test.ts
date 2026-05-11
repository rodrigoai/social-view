/**
 * @jest-environment node
 */
import { GET as getPageSpeedDashboard } from '@/app/api/pagespeed/dashboard/route';
import { prisma } from '@/lib/prisma';

const originalFetch = global.fetch;

jest.mock('@/lib/prisma', () => ({
  prisma: {
    mainAccount: {
      findUnique: jest.fn(),
    }
  }
}));

describe('PageSpeed Insights dashboard API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = originalFetch;
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('requires mainAccountId', async () => {
    const res = await getPageSpeedDashboard(new Request('http://localhost/api/pagespeed/dashboard'));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('mainAccountId is required');
  });

  it('returns an unconfigured state when the account has no main website', async () => {
    (prisma.mainAccount.findUnique as jest.Mock).mockResolvedValue({ mainWebsiteUrl: null });

    const res = await getPageSpeedDashboard(new Request('http://localhost/api/pagespeed/dashboard?mainAccountId=acc1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      configured: false,
      url: null,
      scores: []
    });
    expect(global.fetch).toBe(originalFetch);
  });

  it('calls PageSpeed Insights for mobile and desktop with all Lighthouse categories', async () => {
    (prisma.mainAccount.findUnique as jest.Mock).mockResolvedValue({ mainWebsiteUrl: 'example.com' });
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const pageSpeedUrl = new URL(String(input));
      const strategy = pageSpeedUrl.searchParams.get('strategy');
      const performanceScore = strategy === 'desktop' ? 0.78 : 0.52;

      return {
        ok: true,
        json: async () => ({
          id: 'https://example.com/',
          analysisUTCTimestamp: '2026-05-11T12:00:00.000Z',
          lighthouseResult: {
            finalUrl: 'https://example.com/',
            categories: {
              performance: { score: performanceScore },
              accessibility: { score: 0.92 },
              'best-practices': { score: 1 },
              seo: { score: 1 }
            }
          }
        })
      };
    }) as jest.Mock;

    const res = await getPageSpeedDashboard(new Request('http://localhost/api/pagespeed/dashboard?mainAccountId=acc1'));
    const json = await res.json();
    const pageSpeedUrls = (global.fetch as jest.Mock).mock.calls.map((call) => new URL(call[0]));

    expect(res.status).toBe(200);
    expect(pageSpeedUrls).toHaveLength(2);
    expect(pageSpeedUrls.map((url) => url.searchParams.get('strategy')).sort()).toEqual(['desktop', 'mobile']);
    for (const pageSpeedUrl of pageSpeedUrls) {
      expect(pageSpeedUrl.origin + pageSpeedUrl.pathname).toBe('https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed');
      expect(pageSpeedUrl.searchParams.get('url')).toBe('https://example.com');
      expect(pageSpeedUrl.searchParams.getAll('category')).toEqual([
        'performance',
        'accessibility',
        'best-practices',
        'seo'
      ]);
    }
    expect(json.strategies.mobile.scores).toEqual([
      { key: 'performance', label: 'Desempenho', score: 52 },
      { key: 'accessibility', label: 'Acessibilidade', score: 92 },
      { key: 'best-practices', label: 'Práticas recomendadas', score: 100 },
      { key: 'seo', label: 'SEO', score: 100 }
    ]);
    expect(json.strategies.desktop.scores).toEqual([
      { key: 'performance', label: 'Desempenho', score: 78 },
      { key: 'accessibility', label: 'Acessibilidade', score: 92 },
      { key: 'best-practices', label: 'Práticas recomendadas', score: 100 },
      { key: 'seo', label: 'SEO', score: 100 }
    ]);
    expect(json.scores).toEqual(json.strategies.mobile.scores);
  });

  it('returns the PageSpeed API error message when an upstream strategy request fails', async () => {
    (prisma.mainAccount.findUnique as jest.Mock).mockResolvedValue({ mainWebsiteUrl: 'https://example.com' });
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const pageSpeedUrl = new URL(String(input));

      if (pageSpeedUrl.searchParams.get('strategy') === 'desktop') {
        return {
          ok: false,
          status: 429,
          json: async () => ({
            error: { message: 'Quota exceeded' }
          })
        };
      }

      return {
        ok: true,
        json: async () => ({
          lighthouseResult: {
            categories: {
              performance: { score: 1 },
              accessibility: { score: 1 },
              'best-practices': { score: 1 },
              seo: { score: 1 }
            }
          }
        })
      };
    }) as jest.Mock;

    const res = await getPageSpeedDashboard(new Request('http://localhost/api/pagespeed/dashboard?mainAccountId=acc1'));
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe('Quota exceeded');
  });

});
