/**
 * @jest-environment node
 */
import { GET as getCampaigns } from '@/app/api/ads/campaigns/route';
import { prisma } from '@/lib/prisma';
import { OAuth2Client } from 'google-auth-library';

// Mock the Google Ads report call
jest.mock('@/lib/googleAds', () => ({
  getCustomer: jest.fn()
}));

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    googleCredential: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    googleAdsConfig: {
      findMany: jest.fn(),
    }
  }
}));

// Mock google-auth-library
jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      setCredentials: jest.fn(),
      refreshAccessToken: jest.fn(),
      getAccessToken: jest.fn(),
      credentials: {},
    }))
  };
});

describe('Automatic Token Refresh', () => {
  const mainAccountId = 'test-account-id';
  const mockRefreshToken = 'mock-refresh-token';
  const mockOldAccessToken = 'old-access-token';
  const mockNewAccessToken = 'new-access-token';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
    (console.warn as jest.Mock).mockRestore();
    (console.log as jest.Mock).mockRestore();
  });

  it('should refresh token and retry on 401 Unauthorized', async () => {
    const { getCustomer } = require('@/lib/googleAds');
    
    // 1. Setup Prisma mock
    (prisma.googleCredential.findUnique as jest.Mock).mockResolvedValue({
      mainAccountId,
      accessToken: mockOldAccessToken,
      refreshToken: mockRefreshToken,
      expiresAt: new Date(Date.now() + 3600000).getTime(), // 1 hour from now
    });

    (prisma.googleAdsConfig.findMany as jest.Mock).mockResolvedValue([{ customerId: '123' }]);

    // 2. Setup OAuth Client mock
    const mockOAuthInstance = (OAuth2Client as unknown as jest.Mock).mock.results[0]?.value || new (OAuth2Client as any)();
    
    // We need to mock the implementation of the instance methods
    mockOAuthInstance.refreshAccessToken.mockResolvedValue({
      credentials: {
        access_token: mockNewAccessToken,
        expiry_date: Date.now() + 3600000,
      }
    });

    mockOAuthInstance.getAccessToken
      .mockResolvedValueOnce({ token: mockOldAccessToken })
      .mockResolvedValueOnce({ token: mockNewAccessToken });
    
    mockOAuthInstance.credentials = { refresh_token: mockRefreshToken };
    
    // Ensure every time a new client is created, it has these mocks
    (OAuth2Client as unknown as jest.Mock).mockImplementation(() => mockOAuthInstance);

    // 3. Setup Google Ads API mock to fail once with 401 and then succeed
    const mockReport = jest.fn()
      .mockRejectedValueOnce({
        // Simulate a 401 error from Google Ads API
        code: 401,
        message: 'Request is missing required authentication credential.',
        response: { status: 401 }
      })
      .mockResolvedValueOnce([
        { 
          campaign: { id: '1', name: 'Success Campaign', primary_status: 'ELIGIBLE' }, 
          metrics: { cost_micros: 1000000, conversions: 1 } 
        }
      ]);

    (getCustomer as jest.Mock).mockReturnValue({
      report: mockReport
    });

    // 4. Execute the request
    const req = new Request(`http://localhost/api/ads/campaigns?mainAccountId=${mainAccountId}`);
    const response = await getCampaigns(req);
    const json = await response.json();

    // 5. Assertions
    expect(response.status).toBe(200);
    expect(json.campaigns[0].name).toBe('Success Campaign');

    // Verify refresh was called
    expect(mockOAuthInstance.refreshAccessToken).toHaveBeenCalledTimes(1);
    
    // Verify database was updated with new token
    expect(prisma.googleCredential.update).toHaveBeenCalledWith({
      where: { mainAccountId },
      data: expect.objectContaining({
        accessToken: mockNewAccessToken
      })
    });

    // Verify retry happened
    expect(mockReport).toHaveBeenCalledTimes(2);
  });

  it('should return 401 if refresh fails', async () => {
    const { getCustomer } = require('@/lib/googleAds');

    (prisma.googleCredential.findUnique as jest.Mock).mockResolvedValue({
      mainAccountId,
      accessToken: mockOldAccessToken,
      refreshToken: mockRefreshToken,
    });

    const mockOAuthInstance = new (OAuth2Client as any)();
    mockOAuthInstance.refreshAccessToken.mockRejectedValue(new Error('Invalid Refresh Token'));
    mockOAuthInstance.getAccessToken.mockResolvedValue({ token: mockOldAccessToken });
    mockOAuthInstance.credentials = { refresh_token: mockRefreshToken };
    
    (OAuth2Client as unknown as jest.Mock).mockImplementation(() => mockOAuthInstance);

    const mockReport = jest.fn().mockRejectedValue({
      code: 401,
      response: { status: 401 }
    });

    (getCustomer as jest.Mock).mockReturnValue({
      report: mockReport
    });

    const req = new Request(`http://localhost/api/ads/campaigns?mainAccountId=${mainAccountId}`);
    const response = await getCampaigns(req);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.code).toBe('AUTH_REQUIRED');
  });
});
