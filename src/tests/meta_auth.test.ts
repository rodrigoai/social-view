/**
 * @jest-environment node
 */
import { GET as getMetaAdsAccounts } from '@/app/api/meta/ads/accounts/route';
import { GET as getFacebookPagesAccounts } from '@/app/api/meta/facebook-pages/accounts/route';
import { GET as getInstagramAccounts } from '@/app/api/meta/instagram/accounts/route';
import { GET as getMetaAdsCampaigns } from '@/app/api/meta/ads/campaigns/route';
import { GET as getInstagramDashboard } from '@/app/api/meta/instagram/dashboard/route';
import { GET as getFacebookPagesDashboard } from '@/app/api/meta/facebook-pages/dashboard/route';
import { prisma } from '@/lib/prisma';

const originalFetch = global.fetch;

jest.mock('@/lib/prisma', () => ({
  prisma: {
    metaCredential: {
      findUnique: jest.fn(),
    },
    metaAdsConfig: {
      findMany: jest.fn(),
    },
    instagramPageConfig: {
      findMany: jest.fn(),
    },
    instagramFollowersHistory: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    facebookPageConfig: {
      findMany: jest.fn(),
    }
  }
}));

jest.mock('facebook-nodejs-business-sdk', () => ({
  FacebookAdsApi: {
    init: jest.fn()
  },
  AdAccount: jest.fn().mockImplementation(() => ({
    getInsights: jest.fn()
  }))
}));

describe('Meta authentication handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = originalFetch;
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('returns AUTH_REQUIRED for expired Meta Ads account credentials', async () => {
    (prisma.metaCredential.findUnique as jest.Mock).mockResolvedValue({
      longLivedToken: 'expired-token',
      expiresAt: Date.now() - 60_000
    });

    const req = new Request('http://localhost/api/meta/ads/accounts?mainAccountId=acc1');
    const res = await getMetaAdsAccounts(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.code).toBe('AUTH_REQUIRED');
  });

  it('returns AUTH_REQUIRED for expired Facebook page account credentials', async () => {
    (prisma.metaCredential.findUnique as jest.Mock).mockResolvedValue({
      longLivedToken: 'expired-token',
      expiresAt: Date.now() - 60_000
    });

    const req = new Request('http://localhost/api/meta/facebook-pages/accounts?mainAccountId=acc1');
    const res = await getFacebookPagesAccounts(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.code).toBe('AUTH_REQUIRED');
  });

  it('returns AUTH_REQUIRED for expired Instagram account credentials', async () => {
    (prisma.metaCredential.findUnique as jest.Mock).mockResolvedValue({
      longLivedToken: 'expired-token',
      expiresAt: Date.now() - 60_000
    });

    const req = new Request('http://localhost/api/meta/instagram/accounts?mainAccountId=acc1');
    const res = await getInstagramAccounts(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.code).toBe('AUTH_REQUIRED');
  });

  it('normalizes downstream token failures from Meta into AUTH_REQUIRED', async () => {
    (prisma.metaCredential.findUnique as jest.Mock).mockResolvedValue({
      longLivedToken: 'token',
      expiresAt: Date.now() + 600_000
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          message: 'Error validating access token: Session has expired',
          code: 190
        }
      })
    }) as jest.Mock;

    const req = new Request('http://localhost/api/meta/ads/accounts?mainAccountId=acc1');
    const res = await getMetaAdsAccounts(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.code).toBe('AUTH_REQUIRED');
  });

  it('returns AUTH_REQUIRED for expired Meta Ads dashboard credentials', async () => {
    (prisma.metaCredential.findUnique as jest.Mock).mockResolvedValue({
      longLivedToken: 'expired-token',
      expiresAt: Date.now() - 60_000
    });

    const req = new Request('http://localhost/api/meta/ads/campaigns?mainAccountId=acc1');
    const res = await getMetaAdsCampaigns(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.code).toBe('AUTH_REQUIRED');
  });

  it('accepts Meta credentials with no expiresAt and fetches accounts', async () => {
    (prisma.metaCredential.findUnique as jest.Mock).mockResolvedValue({
      longLivedToken: 'token-without-expiry',
      expiresAt: null
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ account_id: '123', name: 'Test Ad Account' }]
      })
    }) as jest.Mock;

    const req = new Request('http://localhost/api/meta/ads/accounts?mainAccountId=acc1');
    const res = await getMetaAdsAccounts(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.accounts).toEqual([{
      id: '123',
      actId: 'act_123',
      name: 'Test Ad Account',
      currency: null,
      accountStatus: null,
    }]);
  });

  it('sums Instagram dashboard insights from total_value responses', async () => {
    (prisma.metaCredential.findUnique as jest.Mock).mockResolvedValue({
      longLivedToken: 'token',
      expiresAt: Date.now() + 600_000
    });
    (prisma.instagramPageConfig.findMany as jest.Mock).mockResolvedValue([{
      igAccountId: 'ig1',
      igAccountName: 'socialview'
    }]);
    (prisma.instagramFollowersHistory.upsert as jest.Mock).mockResolvedValue({});
    (prisma.instagramFollowersHistory.findMany as jest.Mock).mockResolvedValue([]);

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/ig1/insights')) {
        const metric = new URL(url).searchParams.get('metric');
        const values: Record<string, number> = {
          reach: 1200,
          views: 3400,
          profile_views: 56
        };

        return {
          ok: true,
          json: async () => ({ data: [{ name: metric, total_value: { value: values[metric || ''] } }] })
        };
      }

      if (url.includes('/ig1/media')) {
        return { ok: true, json: async () => ({ data: [] }) };
      }

      return {
        ok: true,
        json: async () => ({ username: 'socialview', followers_count: 100, media_count: 10 })
      };
    }) as jest.Mock;

    const req = new Request('http://localhost/api/meta/instagram/dashboard?mainAccountId=acc1&startDate=2026-04-01&endDate=2026-04-30');
    const res = await getInstagramDashboard(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.accounts[0].stats).toEqual({
      impressions: 3400,
      reach: 1200,
      profileViews: 56
    });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('metric=views'));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('metric_type=total_value'));
  });

  it('creates an Instagram followers history record for today through upsert', async () => {
    (prisma.metaCredential.findUnique as jest.Mock).mockResolvedValue({
      longLivedToken: 'token',
      expiresAt: Date.now() + 600_000
    });
    (prisma.instagramPageConfig.findMany as jest.Mock).mockResolvedValue([{
      igAccountId: 'ig1',
      igAccountName: 'socialview'
    }]);
    (prisma.instagramFollowersHistory.upsert as jest.Mock).mockResolvedValue({});
    (prisma.instagramFollowersHistory.findMany as jest.Mock).mockResolvedValue([]);

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/ig1/insights')) {
        return { ok: true, json: async () => ({ data: [{ values: [{ value: 1 }] }] }) };
      }
      if (url.includes('/ig1/media')) {
        return { ok: true, json: async () => ({ data: [] }) };
      }
      return {
        ok: true,
        json: async () => ({ username: 'socialview', followers_count: 321, media_count: 10 })
      };
    }) as jest.Mock;

    const res = await getInstagramDashboard(new Request('http://localhost/api/meta/instagram/dashboard?mainAccountId=acc1'));

    expect(res.status).toBe(200);
    expect(prisma.instagramFollowersHistory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        igAccountId_date: {
          igAccountId: 'ig1',
          date: expect.any(Date)
        }
      },
      create: expect.objectContaining({
        igAccountId: 'ig1',
        followersCount: 321
      })
    }));
  });

  it('updates today Instagram followers history record when it already exists', async () => {
    (prisma.metaCredential.findUnique as jest.Mock).mockResolvedValue({
      longLivedToken: 'token',
      expiresAt: Date.now() + 600_000
    });
    (prisma.instagramPageConfig.findMany as jest.Mock).mockResolvedValue([{
      igAccountId: 'ig1',
      igAccountName: 'socialview'
    }]);
    (prisma.instagramFollowersHistory.upsert as jest.Mock).mockResolvedValue({});
    (prisma.instagramFollowersHistory.findMany as jest.Mock).mockResolvedValue([]);

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/ig1/insights')) {
        return { ok: true, json: async () => ({ data: [{ values: [{ value: 1 }] }] }) };
      }
      if (url.includes('/ig1/media')) {
        return { ok: true, json: async () => ({ data: [] }) };
      }
      return {
        ok: true,
        json: async () => ({ username: 'socialview', followers_count: 654, media_count: 10 })
      };
    }) as jest.Mock;

    const res = await getInstagramDashboard(new Request('http://localhost/api/meta/instagram/dashboard?mainAccountId=acc1'));

    expect(res.status).toBe(200);
    expect(prisma.instagramFollowersHistory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: {
        followersCount: 654
      }
    }));
  });

  it('uses one Instagram followers history record per account per day', async () => {
    (prisma.metaCredential.findUnique as jest.Mock).mockResolvedValue({
      longLivedToken: 'token',
      expiresAt: Date.now() + 600_000
    });
    (prisma.instagramPageConfig.findMany as jest.Mock).mockResolvedValue([{
      igAccountId: 'ig1',
      igAccountName: 'socialview'
    }]);
    (prisma.instagramFollowersHistory.upsert as jest.Mock).mockResolvedValue({});
    (prisma.instagramFollowersHistory.findMany as jest.Mock).mockResolvedValue([]);

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/ig1/insights')) {
        return { ok: true, json: async () => ({ data: [{ values: [{ value: 1 }] }] }) };
      }
      if (url.includes('/ig1/media')) {
        return { ok: true, json: async () => ({ data: [] }) };
      }
      return {
        ok: true,
        json: async () => ({ username: 'socialview', followers_count: 100, media_count: 10 })
      };
    }) as jest.Mock;

    await getInstagramDashboard(new Request('http://localhost/api/meta/instagram/dashboard?mainAccountId=acc1'));

    expect(prisma.instagramFollowersHistory.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.instagramFollowersHistory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        igAccountId_date: {
          igAccountId: 'ig1',
          date: expect.any(Date)
        }
      }
    }));
  });

  it('returns only the last 90 days of Instagram followers history', async () => {
    (prisma.metaCredential.findUnique as jest.Mock).mockResolvedValue({
      longLivedToken: 'token',
      expiresAt: Date.now() + 600_000
    });
    (prisma.instagramPageConfig.findMany as jest.Mock).mockResolvedValue([{
      igAccountId: 'ig1',
      igAccountName: 'socialview'
    }]);
    (prisma.instagramFollowersHistory.upsert as jest.Mock).mockResolvedValue({});
    (prisma.instagramFollowersHistory.findMany as jest.Mock).mockResolvedValue([{
      date: new Date('2026-05-10T00:00:00.000Z'),
      followersCount: 100
    }]);

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/ig1/insights')) {
        return { ok: true, json: async () => ({ data: [{ values: [{ value: 1 }] }] }) };
      }
      if (url.includes('/ig1/media')) {
        return { ok: true, json: async () => ({ data: [] }) };
      }
      return {
        ok: true,
        json: async () => ({ username: 'socialview', followers_count: 100, media_count: 10 })
      };
    }) as jest.Mock;

    const res = await getInstagramDashboard(new Request('http://localhost/api/meta/instagram/dashboard?mainAccountId=acc1'));
    const json = await res.json();
    const findArgs = (prisma.instagramFollowersHistory.findMany as jest.Mock).mock.calls[0][0];
    const today = new Date();
    const expectedStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    expectedStart.setDate(expectedStart.getDate() - 89);

    expect(res.status).toBe(200);
    expect(findArgs).toEqual(expect.objectContaining({
      where: {
        igAccountId: 'ig1',
        date: {
          gte: expectedStart
        }
      },
      orderBy: {
        date: 'asc'
      }
    }));
    expect(json.accounts[0].followersHistory).toEqual([{ date: '2026-05-10', followers: 100 }]);
  });

  it('does not delete Instagram followers history older than 90 days', async () => {
    (prisma.metaCredential.findUnique as jest.Mock).mockResolvedValue({
      longLivedToken: 'token',
      expiresAt: Date.now() + 600_000
    });
    (prisma.instagramPageConfig.findMany as jest.Mock).mockResolvedValue([{
      igAccountId: 'ig1',
      igAccountName: 'socialview'
    }]);
    (prisma.instagramFollowersHistory.upsert as jest.Mock).mockResolvedValue({});
    (prisma.instagramFollowersHistory.findMany as jest.Mock).mockResolvedValue([]);

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/ig1/insights')) {
        return { ok: true, json: async () => ({ data: [{ values: [{ value: 1 }] }] }) };
      }
      if (url.includes('/ig1/media')) {
        return { ok: true, json: async () => ({ data: [] }) };
      }
      return {
        ok: true,
        json: async () => ({ username: 'socialview', followers_count: 100, media_count: 10 })
      };
    }) as jest.Mock;

    const res = await getInstagramDashboard(new Request('http://localhost/api/meta/instagram/dashboard?mainAccountId=acc1'));

    expect(res.status).toBe(200);
    expect(prisma.instagramFollowersHistory.delete).not.toHaveBeenCalled();
    expect(prisma.instagramFollowersHistory.deleteMany).not.toHaveBeenCalled();
  });

  it('uses Facebook page insights for engagement when post engagement is unavailable', async () => {
    (prisma.facebookPageConfig.findMany as jest.Mock).mockResolvedValue([{
      pageId: 'page1',
      pageName: 'SocialView',
      accessToken: 'page-token'
    }]);

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/page1/insights')) {
        const metric = new URL(url).searchParams.get('metric');
        const values: Record<string, number> = {
          page_media_view: 5000,
          page_total_media_view_unique: 3000,
          page_post_engagements: 222
        };

        return {
          ok: true,
          json: async () => ({ data: [{ name: metric, values: [{ value: values[metric || ''] }] }] })
        };
      }

      if (url.includes('/page1/posts')) {
        return { ok: true, json: async () => ({ data: [] }) };
      }

      return {
        ok: true,
        json: async () => ({ name: 'SocialView', fan_count: 10, followers_count: 20 })
      };
    }) as jest.Mock;

    const req = new Request('http://localhost/api/meta/facebook-pages/dashboard?mainAccountId=acc1&startDate=2026-04-01&endDate=2026-04-30');
    const res = await getFacebookPagesDashboard(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.pages[0].stats).toEqual({
      impressions: 5000,
      reach: 3000,
      engagement: 222
    });
  });
});
