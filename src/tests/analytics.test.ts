/**
 * @jest-environment node
 */
import { GET as getAnalyticsDashboard } from '@/app/api/analytics/dashboard/route';
import { prisma } from '@/lib/prisma';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    googleCredential: {
      findUnique: jest.fn(),
    },
    googleAnalyticsConfig: {
      findMany: jest.fn(),
    }
  }
}));

jest.mock('@google-analytics/data', () => ({
  BetaAnalyticsDataClient: jest.fn().mockImplementation(() => ({
    runReport: jest.fn()
  }))
}));

jest.mock('@/lib/googleAuth', () => ({
  getAuthorizedClient: jest.fn(),
  getGoogleOAuthClient: jest.fn(),
  withGoogleAuth: jest.fn().mockImplementation(async (accountId, operation) => {
    const { getAuthorizedClient } = require('@/lib/googleAuth');
    const client = await getAuthorizedClient(accountId);
    return operation(client);
  })
}));


describe('Analytics Dashboard API', () => {
  let mockRunReport: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRunReport = (BetaAnalyticsDataClient as any).mock.results[0]?.value.runReport || jest.fn();
  });

  it('returns empty properties if no configs found', async () => {
    const { getAuthorizedClient } = require('@/lib/googleAuth');
    (getAuthorizedClient as jest.Mock).mockResolvedValue({
      getAccessToken: jest.fn().mockResolvedValue({ token: 'token' }),
      credentials: { access_token: 'token' }
    });
    (prisma.googleAnalyticsConfig.findMany as jest.Mock).mockResolvedValue([]);


    const req = new Request('http://localhost/api/analytics/dashboard?mainAccountId=test');
    const response = await getAnalyticsDashboard(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.properties).toEqual([]);
  });

  it('returns individual results for multiple properties', async () => {
    const { getAuthorizedClient } = require('@/lib/googleAuth');
    (getAuthorizedClient as jest.Mock).mockResolvedValue({
      getAccessToken: jest.fn().mockResolvedValue({ token: 'token' }),
      credentials: { access_token: 'token' }
    });
    (prisma.googleAnalyticsConfig.findMany as jest.Mock).mockResolvedValue([

      { propertyId: 'properties/1', propertyName: 'Prop 1' },
      { propertyId: 'properties/2', propertyName: 'Prop 2' }
    ]);

    const runReportMock = jest.fn()
      .mockResolvedValueOnce([{
        rows: [{ metricValues: [{ value: '100' }, { value: '50' }, { value: '200' }, { value: '0.2' }, { value: '120' }] }]
      }])
      .mockResolvedValueOnce([{
        rows: [{ metricValues: [{ value: '150' }, { value: '75' }, { value: '300' }, { value: '0.3' }, { value: '180' }] }]
      }]);

    (BetaAnalyticsDataClient as any).mockImplementation(() => ({
      runReport: runReportMock
    }));

    const req = new Request('http://localhost/api/analytics/dashboard?mainAccountId=test&period=7d');
    const response = await getAnalyticsDashboard(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.properties.length).toBe(2);
    
    expect(json.properties[0].propertyName).toBe('Prop 1');
    expect(json.properties[0].stats.activeUsers).toBe(100);
    
    expect(json.properties[1].propertyName).toBe('Prop 2');
    expect(json.properties[1].stats.activeUsers).toBe(150);
  });
});
