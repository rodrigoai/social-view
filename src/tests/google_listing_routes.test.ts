/**
 * @jest-environment node
 */
import { GET as getGoogleAdsAccounts } from '@/app/api/ads/accounts/route';
import { GET as getAnalyticsProperties } from '@/app/api/analytics/properties/route';
import { GET as getSearchConsoleSites } from '@/app/api/search-console/sites/route';
import { getCustomer } from '@/lib/googleAds';
import { withGoogleAuth } from '@/lib/googleAuth';
import { AnalyticsAdminServiceClient } from '@google-analytics/admin';
import { GoogleAdsApi } from 'google-ads-api';
import { google } from 'googleapis';

const mockListAccessibleCustomers = jest.fn();

jest.mock('@/lib/googleAuth', () => ({
  withGoogleAuth: jest.fn(),
  getAuthorizedClient: jest.fn(),
}));

jest.mock('@/lib/googleAds', () => ({
  getCustomer: jest.fn(),
}));

jest.mock('@google-analytics/admin', () => ({
  AnalyticsAdminServiceClient: jest.fn(),
}));

jest.mock('google-ads-api', () => ({
  GoogleAdsApi: jest.fn().mockImplementation(() => ({
    listAccessibleCustomers: mockListAccessibleCustomers,
  })),
}));

jest.mock('googleapis', () => ({
  google: {
    searchconsole: jest.fn(),
  },
}));

const authClient = {
  getAccessToken: jest.fn().mockResolvedValue({ token: 'access-token' }),
  credentials: { refresh_token: 'refresh-token' },
};

describe('Google listing routes', () => {
  const originalDeveloperToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'developer-token';
    authClient.getAccessToken.mockResolvedValue({ token: 'access-token' });
    (withGoogleAuth as jest.Mock).mockImplementation(async (_mainAccountId, operation) => operation(authClient));
  });

  afterEach(() => {
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = originalDeveloperToken;
    (console.error as jest.Mock).mockRestore();
  });

  it('requires a main account before listing Analytics properties', async () => {
    const response = await getAnalyticsProperties(new Request('http://localhost/api/analytics/properties'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('mainAccountId is required');
    expect(withGoogleAuth).not.toHaveBeenCalled();
  });

  it('flattens Analytics account summaries into selectable properties', async () => {
    const listAccountSummaries = jest.fn().mockResolvedValue([[
      {
        displayName: 'Primary GA Account',
        propertySummaries: [
          { property: 'properties/123', displayName: 'Website' },
          { property: 'properties/456', displayName: 'Landing Pages' },
        ],
      },
      {
        displayName: 'Empty GA Account',
      },
    ]]);
    (AnalyticsAdminServiceClient as unknown as jest.Mock).mockImplementation(() => ({
      listAccountSummaries,
    }));

    const response = await getAnalyticsProperties(new Request(
      'http://localhost/api/analytics/properties?mainAccountId=main-1',
    ));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(AnalyticsAdminServiceClient).toHaveBeenCalledWith({ authClient });
    expect(json.properties).toEqual([
      {
        id: 'properties/123',
        name: 'Primary GA Account > Website',
        parentAccount: 'Primary GA Account',
      },
      {
        id: 'properties/456',
        name: 'Primary GA Account > Landing Pages',
        parentAccount: 'Primary GA Account',
      },
    ]);
  });

  it('normalizes Google auth errors while listing Analytics properties', async () => {
    (withGoogleAuth as jest.Mock).mockRejectedValue(new Error('REFRESH_TOKEN_MISSING'));

    const response = await getAnalyticsProperties(new Request(
      'http://localhost/api/analytics/properties?mainAccountId=main-1',
    ));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({
      error: 'Google Analytics authentication failed',
      code: 'AUTH_REQUIRED',
      details: 'REFRESH_TOKEN_MISSING',
    });
  });

  it('maps Search Console sites and handles missing siteEntry as an empty list', async () => {
    const list = jest.fn()
      .mockResolvedValueOnce({
        data: {
          siteEntry: [
            { siteUrl: 'https://example.com/', permissionLevel: 'siteOwner' },
            { siteUrl: 'sc-domain:example.org', permissionLevel: 'siteFullUser' },
          ],
        },
      })
      .mockResolvedValueOnce({ data: {} });
    (google.searchconsole as jest.Mock).mockReturnValue({ sites: { list } });

    const firstResponse = await getSearchConsoleSites(new Request(
      'http://localhost/api/search-console/sites?mainAccountId=main-1',
    ));
    const firstJson = await firstResponse.json();
    const secondResponse = await getSearchConsoleSites(new Request(
      'http://localhost/api/search-console/sites?mainAccountId=main-1',
    ));
    const secondJson = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(google.searchconsole).toHaveBeenCalledWith({ version: 'v1', auth: authClient });
    expect(firstJson.sites).toEqual([
      { siteUrl: 'https://example.com/', permissionLevel: 'siteOwner' },
      { siteUrl: 'sc-domain:example.org', permissionLevel: 'siteFullUser' },
    ]);
    expect(secondResponse.status).toBe(200);
    expect(secondJson.sites).toEqual([]);
  });

  it('does not attempt Google Ads OAuth when the developer token is missing', async () => {
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

    const response = await getGoogleAdsAccounts(new Request(
      'http://localhost/api/ads/accounts?mainAccountId=main-1',
    ));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('DEVELOPER_TOKEN_MISSING');
    expect(withGoogleAuth).not.toHaveBeenCalled();
  });

  it('lists enabled Google Ads customers and falls back when a customer detail call fails', async () => {
    mockListAccessibleCustomers.mockResolvedValue({
      resource_names: ['customers/111', 'customers/222', 'customers/333'],
    });
    (getCustomer as jest.Mock)
      .mockReturnValueOnce({
        report: jest.fn().mockResolvedValue([
          {
            customer: {
              id: '111',
              descriptive_name: 'Enabled Account',
              resource_name: 'customers/111',
              status: 'ENABLED',
            },
          },
        ]),
      })
      .mockReturnValueOnce({
        report: jest.fn().mockResolvedValue([
          {
            customer: {
              id: '222',
              descriptive_name: 'Canceled Account',
              resource_name: 'customers/222',
              status: 'CANCELED',
            },
          },
        ]),
      })
      .mockReturnValueOnce({
        report: jest.fn().mockRejectedValue(new Error('details unavailable')),
      });

    const response = await getGoogleAdsAccounts(new Request(
      'http://localhost/api/ads/accounts?mainAccountId=main-1',
    ));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(GoogleAdsApi).toHaveBeenCalledWith({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      developer_token: 'developer-token',
    });
    expect(mockListAccessibleCustomers).toHaveBeenCalledWith('access-token');
    expect(getCustomer).toHaveBeenCalledWith('access-token', '111', 'refresh-token');
    expect(json.customers).toEqual([
      {
        id: '111',
        name: 'Enabled Account',
        resourceName: 'customers/111',
      },
      {
        id: '333',
        name: 'Unnamed Account',
        resourceName: 'customers/333',
      },
    ]);
  });
});
