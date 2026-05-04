/**
 * @jest-environment node
 */
import { GET as getSites } from '@/app/api/search-console/sites/route';
import { POST as selectSites } from '@/app/api/search-console/sites/select/route';
import { GET as getDashboard } from '@/app/api/search-console/dashboard/route';
import { prisma } from '@/lib/prisma';

// Mock googleapis
jest.mock('googleapis', () => ({
  google: {
    searchconsole: jest.fn().mockReturnValue({
      sites: {
        list: jest.fn()
      },
      searchanalytics: {
        query: jest.fn()
      }
    })
  }
}));

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    googleSearchConsoleConfig: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn()
    }
  }
}));

// Mock googleAuth
jest.mock('@/lib/googleAuth', () => ({
  getAuthorizedClient: jest.fn(),
  getGoogleOAuthClient: jest.fn(),
  withGoogleAuth: jest.fn().mockImplementation(async (accountId, operation) => {
    const { getAuthorizedClient } = require('@/lib/googleAuth');
    const client = await getAuthorizedClient(accountId);
    return operation(client);
  })
}));

const { google } = require('googleapis');
const { getAuthorizedClient } = require('@/lib/googleAuth');

// Helper: fake auth client
const mockAuthClient = { credentials: { access_token: 'test_token' } };
let consoleErrorSpy: jest.SpyInstance;

beforeAll(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  consoleErrorSpy.mockRestore();
});

describe('Search Console - Sites API (GET)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 if mainAccountId is missing', async () => {
    const req = new Request('http://localhost/api/search-console/sites');
    const res = await getSites(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it('returns sites list from Google Search Console', async () => {
    (getAuthorizedClient as jest.Mock).mockResolvedValue(mockAuthClient);

    const mockSitesList = jest.fn().mockResolvedValue({
      data: {
        siteEntry: [
          { siteUrl: 'https://example.com/', permissionLevel: 'siteOwner' },
          { siteUrl: 'sc-domain:example.com', permissionLevel: 'siteFullUser' }
        ]
      }
    });
    google.searchconsole.mockReturnValue({ sites: { list: mockSitesList }, searchanalytics: { query: jest.fn() } });

    const req = new Request('http://localhost/api/search-console/sites?mainAccountId=acc1');
    const res = await getSites(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.sites).toHaveLength(2);
    expect(json.sites[0].siteUrl).toBe('https://example.com/');
    expect(json.sites[0].permissionLevel).toBe('siteOwner');
  });

  it('returns 401 when auth fails with NOT_CONFIGURED', async () => {
    (getAuthorizedClient as jest.Mock).mockRejectedValue(new Error('NOT_CONFIGURED'));

    const req = new Request('http://localhost/api/search-console/sites?mainAccountId=acc1');
    const res = await getSites(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.code).toBe('AUTH_REQUIRED');
  });

  it('returns empty sites array when Search Console returns no sites', async () => {
    (getAuthorizedClient as jest.Mock).mockResolvedValue(mockAuthClient);
    const mockSitesList = jest.fn().mockResolvedValue({ data: { siteEntry: [] } });
    google.searchconsole.mockReturnValue({ sites: { list: mockSitesList }, searchanalytics: { query: jest.fn() } });

    const req = new Request('http://localhost/api/search-console/sites?mainAccountId=acc1');
    const res = await getSites(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.sites).toEqual([]);
  });
});

describe('Search Console - Sites Select API (POST)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.googleSearchConsoleConfig.deleteMany as jest.Mock).mockResolvedValue({});
    (prisma.googleSearchConsoleConfig.createMany as jest.Mock).mockResolvedValue({ count: 2 });
  });

  it('returns 400 if mainAccountId is missing', async () => {
    const req = new Request('http://localhost/api/search-console/sites/select', {
      method: 'POST',
      body: JSON.stringify({ sites: [] })
    });
    const res = await selectSites(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 if sites array is missing or not an array', async () => {
    const req = new Request('http://localhost/api/search-console/sites/select', {
      method: 'POST',
      body: JSON.stringify({ mainAccountId: 'acc1' })
    });
    const res = await selectSites(req);
    expect(res.status).toBe(400);
  });

  it('saves selected sites and returns success', async () => {
    const req = new Request('http://localhost/api/search-console/sites/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mainAccountId: 'acc1',
        sites: [
          { siteUrl: 'https://example.com/' },
          { siteUrl: 'sc-domain:example.com' }
        ]
      })
    });
    const res = await selectSites(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(prisma.googleSearchConsoleConfig.deleteMany).toHaveBeenCalledWith({ where: { mainAccountId: 'acc1' } });
    expect(prisma.googleSearchConsoleConfig.createMany).toHaveBeenCalledWith({
      data: [
        { mainAccountId: 'acc1', siteUrl: 'https://example.com/' },
        { mainAccountId: 'acc1', siteUrl: 'sc-domain:example.com' }
      ]
    });
  });

  it('clears all sites when an empty array is provided', async () => {
    const req = new Request('http://localhost/api/search-console/sites/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mainAccountId: 'acc1', sites: [] })
    });
    const res = await selectSites(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(prisma.googleSearchConsoleConfig.deleteMany).toHaveBeenCalledWith({ where: { mainAccountId: 'acc1' } });
    expect(prisma.googleSearchConsoleConfig.createMany).not.toHaveBeenCalled();
  });
});

describe('Search Console - Dashboard API (GET)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 if mainAccountId is missing', async () => {
    const req = new Request('http://localhost/api/search-console/dashboard');
    const res = await getDashboard(req);
    expect(res.status).toBe(400);
  });

  it('returns empty sites array when no configs found', async () => {
    (getAuthorizedClient as jest.Mock).mockResolvedValue(mockAuthClient);
    (prisma.googleSearchConsoleConfig.findMany as jest.Mock).mockResolvedValue([]);

    const req = new Request('http://localhost/api/search-console/dashboard?mainAccountId=acc1');
    const res = await getDashboard(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.sites).toEqual([]);
  });

  it('returns performance stats for each configured site', async () => {
    (getAuthorizedClient as jest.Mock).mockResolvedValue(mockAuthClient);
    (prisma.googleSearchConsoleConfig.findMany as jest.Mock).mockResolvedValue([
      { siteUrl: 'https://example.com/' }
    ]);

    const mockQuery = jest.fn().mockResolvedValue({
      data: {
        rows: [{ clicks: 500, impressions: 10000, ctr: 0.05, position: 12.3 }]
      }
    });
    google.searchconsole.mockReturnValue({
      sites: { list: jest.fn() },
      searchanalytics: { query: mockQuery }
    });

    const req = new Request('http://localhost/api/search-console/dashboard?mainAccountId=acc1&period=7d');
    const res = await getDashboard(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.sites).toHaveLength(1);
    expect(json.sites[0].siteUrl).toBe('https://example.com/');
    expect(json.sites[0].stats.clicks).toBe(500);
    expect(json.sites[0].stats.impressions).toBe(10000);
    expect(json.sites[0].stats.ctr).toBe(0.05);
    expect(json.sites[0].stats.position).toBe(12.3);
  });

  it('returns 401 when auth fails', async () => {
    (getAuthorizedClient as jest.Mock).mockRejectedValue(new Error('REFRESH_FAILED'));

    const req = new Request('http://localhost/api/search-console/dashboard?mainAccountId=acc1');
    const res = await getDashboard(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.code).toBe('AUTH_REQUIRED');
  });

  it('includes site with zero stats and error message when individual site query fails', async () => {
    (getAuthorizedClient as jest.Mock).mockResolvedValue(mockAuthClient);
    (prisma.googleSearchConsoleConfig.findMany as jest.Mock).mockResolvedValue([
      { siteUrl: 'https://failing.com/' }
    ]);

    const mockQuery = jest.fn().mockRejectedValue(new Error('Permission denied'));
    google.searchconsole.mockReturnValue({
      sites: { list: jest.fn() },
      searchanalytics: { query: mockQuery }
    });

    const req = new Request('http://localhost/api/search-console/dashboard?mainAccountId=acc1');
    const res = await getDashboard(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.sites[0].siteUrl).toBe('https://failing.com/');
    expect(json.sites[0].stats.clicks).toBe(0);
    expect(json.sites[0].error).toBeDefined();
  });
});
