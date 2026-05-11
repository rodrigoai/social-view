import { env } from 'process';
import { prisma } from './prisma';

const META_APP_ID = env.META_APP_ID || process.env.META_APP_ID;
const META_APP_SECRET = env.META_APP_SECRET || process.env.META_APP_SECRET;
const META_EXPIRY_LEEWAY_MS = 5 * 60 * 1000;

export function getMetaAuthConfig(origin: string) {
  if (!META_APP_ID || !META_APP_SECRET) {
    throw new Error('META_APP_ID or META_APP_SECRET is not configured');
  }

  return {
    appId: META_APP_ID,
    appSecret: META_APP_SECRET,
    redirectUri: `${origin}/api/auth/meta/callback`,
  };
}

export async function getMetaAccessToken(mainAccountId: string) {
  const credential = await prisma.metaCredential.findUnique({
    where: { mainAccountId }
  });

  if (!credential?.longLivedToken) {
    throw new Error('NOT_CONFIGURED');
  }

  // Meta may omit expires_in on exchange responses. In that case we keep
  // accepting the token and let downstream 190/401 responses force reauth.
  const isExpired =
    credential.expiresAt != null &&
    Date.now() >= (Number(credential.expiresAt) - META_EXPIRY_LEEWAY_MS);

  if (isExpired) {
    throw new Error('TOKEN_EXPIRED');
  }

  return credential.longLivedToken;
}

export function isMetaAuthError(error: any) {
  const message = String(error?.message || '').toLowerCase();
  const code = error?.code ?? error?.error?.code;
  const status = error?.status ?? error?.response?.status;

  return (
    error?.message === 'NOT_CONFIGURED' ||
    error?.message === 'TOKEN_EXPIRED' ||
    code === 190 ||
    status === 401 ||
    message.includes('invalid oauth') ||
    message.includes('invalid access token') ||
    message.includes('session has expired') ||
    message.includes('expired')
  );
}

export function createMetaApiError(payload: any, fallbackMessage: string) {
  const error = new Error(payload?.error?.message || fallbackMessage) as Error & {
    code?: number;
    status?: number;
  };

  if (payload?.error?.code) {
    error.code = payload.error.code;
  }

  if (payload?.error?.error_subcode) {
    error.status = payload.error.error_subcode;
  }

  return error;
}
