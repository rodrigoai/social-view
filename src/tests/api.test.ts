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

jest.mock('@/lib/prisma', () => ({
  prisma: {
    mainAccount: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    googleAdsConfig: {
      findUnique: jest.fn(),
    }
  }
}));

describe('API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      (prisma.googleAdsConfig.findUnique as jest.Mock).mockResolvedValue(null);
      
      const req = new Request('http://localhost/api/ads/campaigns?mainAccountId=123');
      const response = await getCampaigns(req);
      const json = await response.json();
      
      expect(response.status).toBe(401);
      expect(json.error).toBe('Google Ads not configured or authenticated');
    });

    it('GET /api/ads/campaigns returns mock campaigns on success', async () => {
      (prisma.googleAdsConfig.findUnique as jest.Mock).mockResolvedValue({ 
        accessToken: 'valid_token',
        customerId: '123-456-7890'
      });
      
      const req = new Request('http://localhost/api/ads/campaigns?mainAccountId=123');
      const response = await getCampaigns(req);
      const json = await response.json();
      
      expect(response.status).toBe(200);
      expect(json.campaigns.length).toBe(3);
      expect(json.summary.totalCost).toBe(2520.75);
    });
  });
});
