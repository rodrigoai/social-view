/**
 * @jest-environment node
 */
import { GET as getCampaigns } from '@/app/api/ads/campaigns/route';
import { prisma } from '@/lib/prisma';
import { getCustomer } from '@/lib/googleAds';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    googleAdsConfig: {
      findUnique: jest.fn(),
    }
  }
}));

jest.mock('@/lib/googleAds', () => ({
  getCustomer: jest.fn()
}));

describe('Campaign Filters API', () => {
  const mockReport = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    (getCustomer as jest.Mock).mockReturnValue({
      report: mockReport
    });
  });

  const setupMockConfig = () => {
    (prisma.googleAdsConfig.findUnique as jest.Mock).mockResolvedValue({
      accessToken: 'valid_token',
      customerId: '123-456-7890'
    });
  };

  it('handles custom date range correctly', async () => {
    setupMockConfig();
    mockReport.mockResolvedValue([
      {
        campaign: { id: '1', name: 'C1', primary_status: 'ELIGIBLE' },
        metrics: { cost_micros: 1000000, conversions: 5 }
      }
    ]);

    const req = new Request('http://localhost/api/ads/campaigns?mainAccountId=test&period=custom&startDate=2026-04-16&endDate=2026-04-22');
    const response = await getCampaigns(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockReport).toHaveBeenCalledWith(expect.objectContaining({
      from_date: '2026-04-16',
      to_date: '2026-04-22'
    }));
    expect(json.campaigns[0].cost).toBe(1);
  });

  it('uses LAST_7_DAYS by default', async () => {
    setupMockConfig();
    mockReport.mockResolvedValue([]);

    const req = new Request('http://localhost/api/ads/campaigns?mainAccountId=test');
    await getCampaigns(req);

    expect(mockReport).toHaveBeenCalledWith(expect.objectContaining({
      date_constant: 'LAST_7_DAYS'
    }));
  });

  it('uses LAST_30_DAYS for 30d period', async () => {
    setupMockConfig();
    mockReport.mockResolvedValue([]);

    const req = new Request('http://localhost/api/ads/campaigns?mainAccountId=test&period=30d');
    await getCampaigns(req);

    expect(mockReport).toHaveBeenCalledWith(expect.objectContaining({
      date_constant: 'LAST_30_DAYS'
    }));
  });

  it('calculates 90 days range correctly for 90d period', async () => {
    setupMockConfig();
    mockReport.mockResolvedValue([]);

    const req = new Request('http://localhost/api/ads/campaigns?mainAccountId=test&period=90d');
    await getCampaigns(req);

    const call = mockReport.mock.calls[0][0];
    expect(call.from_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(call.to_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    
    // Simple check if from is before to
    expect(new Date(call.from_date).getTime()).toBeLessThan(new Date(call.to_date).getTime());
  });

  it('filters by campaign id correctly', async () => {
    setupMockConfig();
    mockReport.mockResolvedValue([]);

    const req = new Request('http://localhost/api/ads/campaigns?mainAccountId=test&campaign=123456789');
    await getCampaigns(req);

    expect(mockReport).toHaveBeenCalledWith(expect.objectContaining({
      constraints: expect.objectContaining({ 'campaign.id': 123456789 })
    }));
  });

  it('filters by campaign name correctly', async () => {
    setupMockConfig();
    mockReport.mockResolvedValue([]);

    const req = new Request('http://localhost/api/ads/campaigns?mainAccountId=test&campaign=MyCampaign');
    await getCampaigns(req);

    expect(mockReport).toHaveBeenCalledWith(expect.objectContaining({
      constraints: expect.objectContaining({ 'campaign.name': 'MyCampaign' })
    }));
  });
});
