/**
 * @jest-environment node
 */
import { GET as getWaTrackerDashboard, getWaTrackerDateRange } from '@/app/api/wa-tracker/dashboard/route';
import { GET as getWaTrackerLeads } from '@/app/api/wa-tracker/leads/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    mainAccount: {
      findUnique: jest.fn(),
    },
  },
}));

describe('WA Tracker dashboard API', () => {
  const originalToken = process.env.WA_TRACKER_API_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WA_TRACKER_API_TOKEN = 'test-token';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        groups: [
          { source: 'Google', campaignId: null, campaign: '(sem campanha)', leads: 2, proposals: 0, sales: 0 },
          { source: 'Google', campaign_id: '21077147483', campaign: '[CY] [PMax] Painel Acústico', leads: 6, proposals: 2, sales: 1 },
          { source: 'Organic', campaignId: null, campaign: '(sem campanha)', leads: 23, proposals: 3, sales: 0 },
        ],
      }),
      text: async () => '',
    });
  });

  afterEach(() => {
    process.env.WA_TRACKER_API_TOKEN = originalToken;
  });

  it('requires mainAccountId', async () => {
    const response = await getWaTrackerDashboard(new Request('http://localhost/api/wa-tracker/dashboard'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Missing mainAccountId');
  });

  it('returns a not configured response when account has no WA Tracker id', async () => {
    (prisma.mainAccount.findUnique as jest.Mock).mockResolvedValue({ waTrackerAccountId: null });

    const response = await getWaTrackerDashboard(new Request('http://localhost/api/wa-tracker/dashboard?mainAccountId=main-1'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.code).toBe('NOT_CONFIGURED');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls WA Tracker with Bearer token and YYYY-MM-DD dates', async () => {
    (prisma.mainAccount.findUnique as jest.Mock).mockResolvedValue({ waTrackerAccountId: 'cmp5rwgnw0000o6c0swvrrdsb' });

    const response = await getWaTrackerDashboard(new Request('http://localhost/api/wa-tracker/dashboard?mainAccountId=main-1&period=custom&startDate=2026-06-11&endDate=2026-06-17'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://watracker.coyo.com.br/api/leads/summary?account_id=cmp5rwgnw0000o6c0swvrrdsb&from=2026-06-11&to=2026-06-17',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          Accept: 'application/json',
        }),
        cache: 'no-store',
      })
    );
    expect(json.summary).toEqual({
      totalLeads: 31,
      totalOrganicLeads: 23,
      totalAdsLeads: 8,
      totalProposals: 5,
      totalSales: 1,
      avgLeadsPerDay: 31 / 7,
      proposalRate: 5 / 31,
      salesRate: 1 / 31,
    });
    expect(json.campaignOptions.map((campaign: any) => campaign.name)).toEqual([
      'Orgânico',
      '[CY] [PMax] Painel Acústico',
      'Orgânico',
    ]);
  });

  it('filters by campaign name after loading the full API response', async () => {
    (prisma.mainAccount.findUnique as jest.Mock).mockResolvedValue({ waTrackerAccountId: 'wa-123' });

    const response = await getWaTrackerDashboard(new Request('http://localhost/api/wa-tracker/dashboard?mainAccountId=main-1&campaign=%5BCY%5D+%5BPMax%5D+Painel+Ac%C3%BAstico'));
    const json = await response.json();

    expect(json.campaigns).toHaveLength(1);
    expect(json.summary.totalLeads).toBe(6);
    expect(json.summary.totalOrganicLeads).toBe(0);
    expect(json.summary.totalAdsLeads).toBe(6);
    expect(json.summary.totalProposals).toBe(2);
    expect(json.summary.totalSales).toBe(1);
    expect(json.summary.avgLeadsPerDay).toBe(6 / 8);
    expect(json.campaignOptions).toHaveLength(3);
  });

  it('rejects invalid custom date ranges before calling WA Tracker', async () => {
    (prisma.mainAccount.findUnique as jest.Mock).mockResolvedValue({ waTrackerAccountId: 'wa-123' });

    const response = await getWaTrackerDashboard(new Request('http://localhost/api/wa-tracker/dashboard?mainAccountId=main-1&period=custom&startDate=2026-06-18&endDate=2026-06-17'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('startDate cannot be after endDate');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('handles malformed API payloads as an empty result set', async () => {
    (prisma.mainAccount.findUnique as jest.Mock).mockResolvedValue({ waTrackerAccountId: 'wa-123' });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ groups: 'not-an-array' }),
      text: async () => '',
    });

    const response = await getWaTrackerDashboard(new Request('http://localhost/api/wa-tracker/dashboard?mainAccountId=main-1'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.campaigns).toEqual([]);
    expect(json.summary.totalLeads).toBe(0);
  });

  it('normalizes relative date ranges to ISO dates', () => {
    expect(getWaTrackerDateRange('7d', undefined, undefined, new Date('2026-06-17T15:30:00.000Z'))).toEqual({
      from: '2026-06-10',
      to: '2026-06-17',
    });
  });

  it('lists leads with server-side account id, date, status, and campaign normalization', async () => {
    (prisma.mainAccount.findUnique as jest.Mock).mockResolvedValue({ waTrackerAccountId: 'wa-account' });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'lead-1',
            name: 'Maria Silva',
            email: 'maria@example.com',
            phone: '+5511999990000',
            status: null,
            conversion_time: '2026-06-17T15:30:00.000Z',
            conversion_name: 'WhatsApp Conversion',
            value: 0,
            currency: 'BRL',
            utm_source: null,
            utm_campaign: '(sem campanha)',
            utm_medium: null,
            enrichment_status: null,
            google_ads: { gclid: null, campaign_id: null, campaign_name: null },
          },
          {
            id: 'lead-2',
            name: 'Joao Santos',
            status: 'Venda',
            conversion_time: '2026-06-16T10:00:00.000Z',
            conversion_name: 'WhatsApp Conversion',
            value: 0,
            currency: 'BRL',
            utm_source: 'google',
            utm_campaign: 'Fallback Campaign',
            utm_medium: 'cpc',
            enrichment_status: 'ENRICHED',
            google_ads: { gclid: 'gclid-1', campaign_id: '123', campaign_name: 'Search Campaign' },
          },
        ],
        pagination: { next_cursor: 'next-1', has_more: true, page_size: 50 },
      }),
      text: async () => '',
    });

    const response = await getWaTrackerLeads(new Request('http://localhost/api/wa-tracker/leads?mainAccountId=main-1&period=custom&startDate=2026-06-11&endDate=2026-06-17&status=Venda&campaign=all'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://watracker.coyo.com.br/api/leads?account_id=wa-account&from=2026-06-11&to=2026-06-17&page_size=50&status=Venda',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          Accept: 'application/json',
        }),
        cache: 'no-store',
      })
    );
    expect(json.data[0]).toEqual(expect.objectContaining({
      id: 'lead-1',
      status: 'Not Qualified',
      source: 'Orgânico',
      campaign: 'Orgânico',
    }));
    expect(json.data[1]).toEqual(expect.objectContaining({
      id: 'lead-2',
      status: 'Venda',
      source: 'Google',
      campaign: 'Search Campaign',
    }));
    expect(json.pagination.next_cursor).toBe('next-1');
  });

  it('filters lead pages by campaign and rejects invalid statuses', async () => {
    (prisma.mainAccount.findUnique as jest.Mock).mockResolvedValue({ waTrackerAccountId: 'wa-account' });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'lead-1', status: 'Proposta', conversion_time: '2026-06-17T15:30:00.000Z', conversion_name: 'WhatsApp Conversion', value: 0, currency: 'BRL', google_ads: { campaign_name: 'Campaign A' } },
          { id: 'lead-2', status: 'Venda', conversion_time: '2026-06-17T15:31:00.000Z', conversion_name: 'WhatsApp Conversion', value: 0, currency: 'BRL', google_ads: { campaign_name: 'Campaign B' } },
        ],
        pagination: { next_cursor: null, has_more: false, page_size: 50 },
      }),
      text: async () => '',
    });

    const response = await getWaTrackerLeads(new Request('http://localhost/api/wa-tracker/leads?mainAccountId=main-1&campaign=Campaign+A'));
    const json = await response.json();

    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe('lead-1');

    const invalidResponse = await getWaTrackerLeads(new Request('http://localhost/api/wa-tracker/leads?mainAccountId=main-1&status=Invalid'));
    expect(invalidResponse.status).toBe(400);
  });
});
