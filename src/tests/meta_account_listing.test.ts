/**
 * @jest-environment node
 */
import { GET as getMetaAdsAccounts } from '@/app/api/meta/ads/accounts/route';
import { GET as getFacebookPages } from '@/app/api/meta/facebook-pages/accounts/route';
import { GET as getInstagramAccounts } from '@/app/api/meta/instagram/accounts/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    metaCredential: {
      findUnique: jest.fn(),
    },
  },
}));

describe('Meta account listing pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (prisma.metaCredential.findUnique as jest.Mock).mockResolvedValue({
      longLivedToken: 'meta-token',
      expiresAt: Date.now() + 600_000,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns ad accounts from every Graph API page', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ account_id: '111', name: 'First account', currency: 'USD' }],
          paging: { next: 'https://graph.facebook.com/v25.0/me/adaccounts?after=next-page' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ account_id: '222', name: 'Second account' }] }),
      }) as jest.Mock;

    const response = await getMetaAdsAccounts(new Request(
      'http://localhost/api/meta/ads/accounts?mainAccountId=main-1',
    ));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.accounts.map((account: { id: string }) => account.id)).toEqual(['111', '222']);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const firstUrl = new URL(String((global.fetch as jest.Mock).mock.calls[0][0]));
    expect(firstUrl.searchParams.get('limit')).toBe('100');
  });

  it('returns Facebook Pages from every Graph API page', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'page-1', name: 'First page', access_token: 'page-token-1' }],
          paging: { next: 'https://graph.facebook.com/v25.0/me/accounts?after=next-page' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'page-2', name: 'Second page', access_token: 'page-token-2' }],
        }),
      }) as jest.Mock;

    const response = await getFacebookPages(new Request(
      'http://localhost/api/meta/facebook-pages/accounts?mainAccountId=main-1',
    ));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.accounts).toEqual([
      { id: 'page-1', name: 'First page', accessToken: 'page-token-1' },
      { id: 'page-2', name: 'Second page', accessToken: 'page-token-2' },
    ]);
  });

  it('finds Instagram accounts attached to Facebook Pages on later pages', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'page-1', name: 'Page without Instagram' }],
          paging: { next: 'https://graph.facebook.com/v25.0/me/accounts?after=next-page' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{
            id: 'page-2',
            name: 'Page with Instagram',
            instagram_business_account: { id: 'ig-2', username: 'second_brand' },
          }],
        }),
      }) as jest.Mock;

    const response = await getInstagramAccounts(new Request(
      'http://localhost/api/meta/instagram/accounts?mainAccountId=main-1',
    ));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.accounts).toEqual([{
      id: 'ig-2',
      name: 'second_brand',
      facebookPageId: 'page-2',
    }]);
  });
});

