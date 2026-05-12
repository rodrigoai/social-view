/**
 * @jest-environment node
 */
import { POST as selectGoogleAdsAccount } from '@/app/api/ads/accounts/select/route';
import { POST as selectAnalyticsProperties } from '@/app/api/analytics/properties/select/route';
import { POST as selectSearchConsoleSites } from '@/app/api/search-console/sites/select/route';
import { POST as selectMetaAdsAccount } from '@/app/api/meta/ads/accounts/select/route';
import { POST as selectFacebookPage } from '@/app/api/meta/facebook-pages/accounts/select/route';
import { POST as selectInstagramAccount } from '@/app/api/meta/instagram/accounts/select/route';
import { POST as clearIntegration } from '@/app/api/integrations/clear/route';
import { POST as disconnectGoogle } from '@/app/api/auth/google/disconnect/route';
import { POST as disconnectMeta } from '@/app/api/auth/meta/disconnect/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    googleAdsConfig: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    googleAnalyticsConfig: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    googleSearchConsoleConfig: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    googleCredential: {
      delete: jest.fn(),
    },
    metaAdsConfig: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    facebookPageConfig: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    instagramPageConfig: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    metaCredential: {
      delete: jest.fn(),
    },
  },
}));

const jsonRequest = (body: unknown) =>
  new Request('http://localhost/api/test', {
    method: 'POST',
    body: JSON.stringify(body),
  });

describe('integration management routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (prisma.$transaction as jest.Mock).mockResolvedValue([]);
    Object.values(prisma).forEach((model) => {
      if (model && typeof model === 'object') {
        Object.values(model).forEach((method) => {
          if (jest.isMockFunction(method)) {
            method.mockResolvedValue({});
          }
        });
      }
    });
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('upserts a Google Ads account using the account-specific unique key', async () => {
    const response = await selectGoogleAdsAccount(jsonRequest({
      mainAccountId: 'main-1',
      customerId: '123-456-7890',
    }));

    await expect(response.json()).resolves.toEqual({ success: true });
    expect(prisma.googleAdsConfig.upsert).toHaveBeenCalledWith({
      where: {
        mainAccountId_customerId: {
          mainAccountId: 'main-1',
          customerId: '123-456-7890',
        },
      },
      update: {},
      create: {
        mainAccountId: 'main-1',
        customerId: '123-456-7890',
      },
    });
  });

  it('replaces selected Google Analytics properties and preserves tracked event names', async () => {
    const response = await selectAnalyticsProperties(jsonRequest({
      mainAccountId: 'main-1',
      properties: [
        { id: 'properties/1', name: 'Main Site', trackedEventName: 'generate_lead' },
        { id: 'properties/2', name: 'Blog' },
      ],
    }));

    expect(response.status).toBe(200);
    expect(prisma.googleAnalyticsConfig.deleteMany).toHaveBeenCalledWith({
      where: { mainAccountId: 'main-1' },
    });
    expect(prisma.googleAnalyticsConfig.createMany).toHaveBeenCalledWith({
      data: [
        {
          mainAccountId: 'main-1',
          propertyId: 'properties/1',
          propertyName: 'Main Site',
          trackedEventName: 'generate_lead',
        },
        {
          mainAccountId: 'main-1',
          propertyId: 'properties/2',
          propertyName: 'Blog',
          trackedEventName: null,
        },
      ],
    });
  });

  it('clears Google Analytics properties without creating empty replacement rows', async () => {
    const response = await selectAnalyticsProperties(jsonRequest({
      mainAccountId: 'main-1',
      properties: [],
    }));

    expect(response.status).toBe(200);
    expect(prisma.googleAnalyticsConfig.deleteMany).toHaveBeenCalledWith({
      where: { mainAccountId: 'main-1' },
    });
    expect(prisma.googleAnalyticsConfig.createMany).not.toHaveBeenCalled();
  });

  it('rejects malformed selection payloads before writing anything', async () => {
    const response = await selectSearchConsoleSites(jsonRequest({
      mainAccountId: 'main-1',
      sites: { siteUrl: 'https://example.com/' },
    }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Missing mainAccountId or valid sites array');
    expect(prisma.googleSearchConsoleConfig.deleteMany).not.toHaveBeenCalled();
    expect(prisma.googleSearchConsoleConfig.createMany).not.toHaveBeenCalled();
  });

  it('replaces selected Search Console sites for one main account', async () => {
    const response = await selectSearchConsoleSites(jsonRequest({
      mainAccountId: 'main-1',
      sites: [
        { siteUrl: 'https://example.com/' },
        { siteUrl: 'sc-domain:example.org' },
      ],
    }));

    expect(response.status).toBe(200);
    expect(prisma.googleSearchConsoleConfig.deleteMany).toHaveBeenCalledWith({
      where: { mainAccountId: 'main-1' },
    });
    expect(prisma.googleSearchConsoleConfig.createMany).toHaveBeenCalledWith({
      data: [
        { mainAccountId: 'main-1', siteUrl: 'https://example.com/' },
        { mainAccountId: 'main-1', siteUrl: 'sc-domain:example.org' },
      ],
    });
  });

  it('updates Meta Ads account names when a selected ad account already exists', async () => {
    const response = await selectMetaAdsAccount(jsonRequest({
      mainAccountId: 'main-1',
      accountId: 'act_123',
      accountName: 'Paid Social',
    }));

    expect(response.status).toBe(200);
    expect(prisma.metaAdsConfig.upsert).toHaveBeenCalledWith({
      where: {
        mainAccountId_adAccountId: {
          mainAccountId: 'main-1',
          adAccountId: 'act_123',
        },
      },
      update: { adAccountName: 'Paid Social' },
      create: {
        mainAccountId: 'main-1',
        adAccountId: 'act_123',
        adAccountName: 'Paid Social',
      },
    });
  });

  it('stores Facebook page access tokens with the selected page', async () => {
    const response = await selectFacebookPage(jsonRequest({
      mainAccountId: 'main-1',
      accountId: 'page-1',
      accountName: 'Brand Page',
      accessToken: 'page-token',
    }));

    expect(response.status).toBe(200);
    expect(prisma.facebookPageConfig.upsert).toHaveBeenCalledWith({
      where: {
        mainAccountId_pageId: {
          mainAccountId: 'main-1',
          pageId: 'page-1',
        },
      },
      update: {
        pageName: 'Brand Page',
        accessToken: 'page-token',
      },
      create: {
        mainAccountId: 'main-1',
        pageId: 'page-1',
        pageName: 'Brand Page',
        accessToken: 'page-token',
      },
    });
  });

  it('links an Instagram business account to its backing Facebook page', async () => {
    const response = await selectInstagramAccount(jsonRequest({
      mainAccountId: 'main-1',
      accountId: 'ig-1',
      accountName: 'Brand Instagram',
      facebookPageId: 'page-1',
    }));

    expect(response.status).toBe(200);
    expect(prisma.instagramPageConfig.upsert).toHaveBeenCalledWith({
      where: {
        mainAccountId_igAccountId: {
          mainAccountId: 'main-1',
          igAccountId: 'ig-1',
        },
      },
      update: {
        igAccountName: 'Brand Instagram',
        facebookPageId: 'page-1',
      },
      create: {
        mainAccountId: 'main-1',
        igAccountId: 'ig-1',
        igAccountName: 'Brand Instagram',
        facebookPageId: 'page-1',
      },
    });
  });

  it.each([
    ['google-ads', 'googleAdsConfig'],
    ['google-analytics', 'googleAnalyticsConfig'],
    ['google-search-console', 'googleSearchConsoleConfig'],
    ['meta-ads', 'metaAdsConfig'],
    ['facebook-pages', 'facebookPageConfig'],
    ['instagram', 'instagramPageConfig'],
  ] as const)('clears only %s configuration for the requested account', async (type, modelName) => {
    const response = await clearIntegration(jsonRequest({
      type,
      mainAccountId: 'main-1',
    }));

    expect(response.status).toBe(200);
    expect((prisma[modelName].deleteMany as jest.Mock)).toHaveBeenCalledWith({
      where: { mainAccountId: 'main-1' },
    });
  });

  it('rejects unknown clear-integration types without deleting configs', async () => {
    const response = await clearIntegration(jsonRequest({
      type: 'linkedin',
      mainAccountId: 'main-1',
    }));

    expect(response.status).toBe(400);
    expect(prisma.googleAdsConfig.deleteMany).not.toHaveBeenCalled();
    expect(prisma.metaAdsConfig.deleteMany).not.toHaveBeenCalled();
  });

  it('disconnects Google by deleting dependent configs and the credential in one transaction', async () => {
    const response = await disconnectGoogle(new Request(
      'http://localhost/api/auth/google/disconnect?mainAccountId=main-1',
      { method: 'POST' },
    ));

    expect(response.status).toBe(200);
    expect(prisma.googleAdsConfig.deleteMany).toHaveBeenCalledWith({ where: { mainAccountId: 'main-1' } });
    expect(prisma.googleAnalyticsConfig.deleteMany).toHaveBeenCalledWith({ where: { mainAccountId: 'main-1' } });
    expect(prisma.googleSearchConsoleConfig.deleteMany).toHaveBeenCalledWith({ where: { mainAccountId: 'main-1' } });
    expect(prisma.googleCredential.delete).toHaveBeenCalledWith({ where: { mainAccountId: 'main-1' } });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    ]);
  });

  it('disconnects Meta by deleting all Meta configs and the credential in one transaction', async () => {
    const response = await disconnectMeta(new Request(
      'http://localhost/api/auth/meta/disconnect?mainAccountId=main-1',
      { method: 'POST' },
    ));

    expect(response.status).toBe(200);
    expect(prisma.metaAdsConfig.deleteMany).toHaveBeenCalledWith({ where: { mainAccountId: 'main-1' } });
    expect(prisma.facebookPageConfig.deleteMany).toHaveBeenCalledWith({ where: { mainAccountId: 'main-1' } });
    expect(prisma.instagramPageConfig.deleteMany).toHaveBeenCalledWith({ where: { mainAccountId: 'main-1' } });
    expect(prisma.metaCredential.delete).toHaveBeenCalledWith({ where: { mainAccountId: 'main-1' } });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    ]);
  });
});
