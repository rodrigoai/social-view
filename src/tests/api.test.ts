/**
 * @jest-environment node
 */
import { GET as getAccounts, POST as postAccount } from '@/app/api/accounts/route';
import { GET as getCampaigns } from '@/app/api/ads/campaigns/route';
import { prisma } from '@/lib/prisma';
import { getCustomer } from '@/lib/googleAds';

jest.mock('@/lib/googleAds', () => ({
  getCustomer: jest.fn(() => ({
    report: jest.fn().mockResolvedValue([
      { campaign: { id: '1', name: 'Mock 1', primary_status: 'ELIGIBLE' }, metrics: { cost_micros: 1000000000, conversions: 5 } },
      { campaign: { id: '2', name: 'Mock 2', primary_status: 'LEARNING' }, metrics: { cost_micros: 1000000000, conversions: 10 } },
      { campaign: { id: '3', name: 'Mock 3', primary_status: 'LIMITED' }, metrics: { cost_micros: 520750000, conversions: 2 } },
    ])
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


jest.mock('@/lib/prisma', () => ({
  prisma: {
    mainAccount: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    googleCredential: {
      findUnique: jest.fn(),
    },
    googleAdsConfig: {
      findMany: jest.fn(),
    }
  }
}));

describe('API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  describe('Accounts API', () => {
    it('GET /api/accounts returns accounts list', async () => {
      const mockAccounts = [{ id: '1', name: 'Test Account' }];
      (prisma.mainAccount.findMany as jest.Mock).mockResolvedValue(mockAccounts);
      
      const response = await getAccounts();
      const json = await response.json();
      
      expect(response.status).toBe(200);
      expect(json.accounts).toEqual(mockAccounts);
    });

    it('POST /api/accounts creates an account', async () => {
      const mockAccount = { id: '2', name: 'New Business' };
      (prisma.mainAccount.create as jest.Mock).mockResolvedValue(mockAccount);
      
      const req = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Business' })
      });
      
      const response = await postAccount(req);
      const json = await response.json();
      
      expect(response.status).toBe(200);
      expect(json.account).toEqual(mockAccount);
    });
  });

  describe('Campaigns API', () => {
    it('GET /api/ads/campaigns requires mainAccountId', async () => {
      const req = new Request('http://localhost/api/ads/campaigns');
      const response = await getCampaigns(req);
      const json = await response.json();
      
      expect(response.status).toBe(400);
      expect(json.error).toBe('mainAccountId is required');
    });

    it('GET /api/ads/campaigns returns 401 if unauthenticated', async () => {
      const { getAuthorizedClient } = require('@/lib/googleAuth');
      (getAuthorizedClient as jest.Mock).mockRejectedValue(new Error('NOT_CONFIGURED'));
      
      const req = new Request('http://localhost/api/ads/campaigns?mainAccountId=123');
      const response = await getCampaigns(req);
      const json = await response.json();
      
      expect(response.status).toBe(401);
      expect(json.error).toBe('Google Ads authentication failed');
    });


    it('GET /api/ads/campaigns returns empty state if no customerId selected', async () => {
      const { getAuthorizedClient } = require('@/lib/googleAuth');
      (getAuthorizedClient as jest.Mock).mockResolvedValue({
        getAccessToken: jest.fn().mockResolvedValue({ token: 'valid_token' }),
        credentials: { refresh_token: 'refresh' }
      });
      (prisma.googleAdsConfig.findMany as jest.Mock).mockResolvedValue([]);

      const req = new Request('http://localhost/api/ads/campaigns?mainAccountId=123');
      const response = await getCampaigns(req);
      const json = await response.json();
      
      expect(response.status).toBe(200);
      expect(json.campaigns).toEqual([]);
      expect(json.summary.totalCost).toBe(0);
    });

    it('GET /api/ads/campaigns returns mock campaigns on success', async () => {

      const { getAuthorizedClient } = require('@/lib/googleAuth');
      (getAuthorizedClient as jest.Mock).mockResolvedValue({
        getAccessToken: jest.fn().mockResolvedValue({ token: 'valid_token' }),
        credentials: { refresh_token: 'refresh' }
      });
      (prisma.googleAdsConfig.findMany as jest.Mock).mockResolvedValue([{ 
        customerId: '123-456-7890'
      }]);

      
      const req = new Request('http://localhost/api/ads/campaigns?mainAccountId=123');
      const response = await getCampaigns(req);
      const json = await response.json();
      
      expect(response.status).toBe(200);
      expect(json.campaigns.length).toBe(3);
      expect(json.summary.totalCost).toBe(2520.75);
    });

    it('GET /api/ads/campaigns aggregates all selected Google Ads accounts', async () => {
      const { getAuthorizedClient } = require('@/lib/googleAuth');
      (getAuthorizedClient as jest.Mock).mockResolvedValue({
        getAccessToken: jest.fn().mockResolvedValue({ token: 'valid_token' }),
        credentials: { refresh_token: 'refresh' }
      });
      (prisma.googleAdsConfig.findMany as jest.Mock).mockResolvedValue([
        { customerId: '123-456-7890' },
        { customerId: '999-888-7777' }
      ]);

      (getCustomer as jest.Mock)
        .mockReturnValueOnce({
          report: jest.fn().mockResolvedValue([
            { campaign: { id: '1', name: 'Customer 1 Campaign', primary_status: 'ELIGIBLE' }, metrics: { cost_micros: 1000000, conversions: 1 } }
          ])
        })
        .mockReturnValueOnce({
          report: jest.fn().mockResolvedValue([
            { campaign: { id: '2', name: 'Customer 2 Campaign', primary_status: 'LEARNING' }, metrics: { cost_micros: 2000000, conversions: 2 } }
          ])
        });

      const req = new Request('http://localhost/api/ads/campaigns?mainAccountId=123');
      const response = await getCampaigns(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.campaigns).toHaveLength(2);
      expect(json.summary.totalCost).toBe(3);
      expect(json.summary.totalConversions).toBe(3);
      expect(json.campaigns.map((campaign: any) => campaign.customerId)).toEqual([
        '123-456-7890',
        '999-888-7777'
      ]);
    });
  });
});
