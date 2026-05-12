/**
 * @jest-environment node
 */
import { GET as startGoogleAuth } from '@/app/api/auth/google/route';
import { GET as handleGoogleCallback } from '@/app/api/auth/google/callback/route';
import { GET as startMetaAuth } from '@/app/api/auth/meta/route';
import { GET as handleMetaCallback } from '@/app/api/auth/meta/callback/route';
import { getGoogleOAuthClient } from '@/lib/googleAuth';
import { getMetaAuthConfig } from '@/lib/metaAuth';
import { prisma } from '@/lib/prisma';

const mockGenerateAuthUrl = jest.fn();
const mockGetToken = jest.fn();

jest.mock('@/lib/googleAuth', () => ({
  getGoogleOAuthClient: jest.fn(),
}));

jest.mock('@/lib/metaAuth', () => ({
  getMetaAuthConfig: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    googleCredential: {
      upsert: jest.fn(),
    },
    metaCredential: {
      upsert: jest.fn(),
    },
  },
}));

describe('OAuth routes', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = originalFetch;
    mockGenerateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?state=main-1');
    mockGetToken.mockResolvedValue({
      tokens: {
        access_token: 'google-access-token',
        refresh_token: 'google-refresh-token',
        expiry_date: 1_777_777_777_000,
      },
    });
    (getGoogleOAuthClient as jest.Mock).mockReturnValue({
      generateAuthUrl: mockGenerateAuthUrl,
      getToken: mockGetToken,
    });
    (getMetaAuthConfig as jest.Mock).mockReturnValue({
      appId: 'meta-app-id',
      appSecret: 'meta-secret',
      redirectUri: 'http://localhost/api/auth/meta/callback',
    });
    (prisma.googleCredential.upsert as jest.Mock).mockResolvedValue({});
    (prisma.metaCredential.upsert as jest.Mock).mockResolvedValue({});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
    global.fetch = originalFetch;
  });

  it('requires a main account before starting Google OAuth', async () => {
    const response = await startGoogleAuth(new Request('http://localhost/api/auth/google'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('mainAccountId is required');
    expect(getGoogleOAuthClient).not.toHaveBeenCalled();
  });

  it('starts Google OAuth with all required scopes and account state', async () => {
    const response = await startGoogleAuth(new Request(
      'http://localhost/api/auth/google?mainAccountId=main-1',
    ));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://accounts.google.com/o/oauth2/v2/auth?state=main-1');
    expect(mockGenerateAuthUrl).toHaveBeenCalledWith({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/adwords',
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/webmasters.readonly',
      ],
      state: 'main-1',
      prompt: 'consent',
    });
  });

  it('stores Google callback tokens and redirects to settings success', async () => {
    const response = await handleGoogleCallback(new Request(
      'http://localhost/api/auth/google/callback?code=oauth-code&state=main-1',
    ));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/settings?success=google_linked');
    expect(mockGetToken).toHaveBeenCalledWith('oauth-code');
    expect(prisma.googleCredential.upsert).toHaveBeenCalledWith({
      where: { mainAccountId: 'main-1' },
      update: {
        accessToken: 'google-access-token',
        expiresAt: 1_777_777_777_000,
        refreshToken: 'google-refresh-token',
      },
      create: {
        mainAccountId: 'main-1',
        accessToken: 'google-access-token',
        refreshToken: 'google-refresh-token',
        expiresAt: 1_777_777_777_000,
      },
    });
  });

  it('does not overwrite an existing Google refresh token when Google omits a new one', async () => {
    mockGetToken.mockResolvedValue({
      tokens: {
        access_token: 'rotated-access-token',
        expiry_date: 1_888_888_888_000,
      },
    });

    const response = await handleGoogleCallback(new Request(
      'http://localhost/api/auth/google/callback?code=oauth-code&state=main-1',
    ));

    expect(response.status).toBe(307);
    expect(prisma.googleCredential.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: {
        accessToken: 'rotated-access-token',
        expiresAt: 1_888_888_888_000,
      },
      create: expect.objectContaining({
        refreshToken: undefined,
      }),
    }));
  });

  it('starts Meta OAuth with configured redirect URI, state, and permissions', async () => {
    const response = await startMetaAuth(new Request(
      'http://localhost/api/auth/meta?mainAccountId=main-1',
    ));
    const location = new URL(response.headers.get('location') || '');

    expect(response.status).toBe(307);
    expect(location.origin + location.pathname).toBe('https://www.facebook.com/v25.0/dialog/oauth');
    expect(location.searchParams.get('client_id')).toBe('meta-app-id');
    expect(location.searchParams.get('redirect_uri')).toBe('http://localhost/api/auth/meta/callback');
    expect(location.searchParams.get('state')).toBe('main-1');
    expect(location.searchParams.get('scope')).toContain('instagram_manage_insights');
  });

  it('returns a setup error when Meta OAuth config is missing', async () => {
    (getMetaAuthConfig as jest.Mock).mockImplementation(() => {
      throw new Error('META_APP_ID or META_APP_SECRET is not configured');
    });

    const response = await startMetaAuth(new Request(
      'http://localhost/api/auth/meta?mainAccountId=main-1',
    ));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('META_APP_ID or META_APP_SECRET is not configured');
  });

  it('exchanges Meta callback tokens, stores expiry, and redirects to success', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'short-lived-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'long-lived-token', expires_in: 60 }),
      }) as jest.Mock;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_777_777_000_000);

    const response = await handleMetaCallback(new Request(
      'http://localhost/api/auth/meta/callback?code=meta-code&state=main-1',
    ));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/settings?success=meta_linked');
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('code=meta-code'),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('fb_exchange_token=short-lived-token'),
    );
    expect(prisma.metaCredential.upsert).toHaveBeenCalledWith({
      where: { mainAccountId: 'main-1' },
      update: {
        accessToken: 'short-lived-token',
        longLivedToken: 'long-lived-token',
        expiresAt: 1_777_777_060_000,
      },
      create: {
        mainAccountId: 'main-1',
        accessToken: 'short-lived-token',
        longLivedToken: 'long-lived-token',
        expiresAt: 1_777_777_060_000,
      },
    });

    nowSpy.mockRestore();
  });

  it('redirects Meta callback failures back to settings with an error flag', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Invalid verification code' } }),
    }) as jest.Mock;

    const response = await handleMetaCallback(new Request(
      'http://localhost/api/auth/meta/callback?code=bad-code&state=main-1',
    ));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/settings?error=meta_link_failed');
    expect(prisma.metaCredential.upsert).not.toHaveBeenCalled();
  });
});
