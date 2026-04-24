import { OAuth2Client } from 'google-auth-library';
import { prisma } from './prisma';

export function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID || 'dummy_client_id';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

export async function getAuthorizedClient(mainAccountId: string) {
  const credential = await prisma.googleCredential.findUnique({
    where: { mainAccountId }
  });

  if (!credential || !credential.accessToken) {
    throw new Error('NOT_CONFIGURED');
  }

  const client = getGoogleOAuthClient();
  client.setCredentials({
    access_token: credential.accessToken,
    refresh_token: credential.refreshToken,
    expiry_date: credential.expiresAt ? Number(credential.expiresAt) : null,
  });

  // Check if token is expired or expires in the next 5 minutes
  const isExpired = !credential.expiresAt || Date.now() >= (Number(credential.expiresAt) - 300000);

  if (isExpired && credential.refreshToken) {
    console.log(`[googleAuth] Token expired for ${mainAccountId}, attempting refresh...`);
    try {
      const { tokens } = await client.refreshAccessToken();
      console.log(`[googleAuth] Token refreshed successfully for ${mainAccountId}`);
      
      // Update database with new tokens
      await prisma.googleCredential.update({
        where: { mainAccountId },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || credential.refreshToken,
          expiresAt: tokens.expiry_date,
        }
      });
      
      return client;
    } catch (error: any) {
      console.error(`[googleAuth] Failed to refresh Google token for ${mainAccountId}:`, error.message || error);
      if (error.response?.data) {
        console.error(`[googleAuth] Error details:`, JSON.stringify(error.response.data));
      }
      throw new Error('REFRESH_FAILED');
    }
  } else if (isExpired && !credential.refreshToken) {
    console.warn(`[googleAuth] Token expired for ${mainAccountId} but no refresh token available`);
    throw new Error('REFRESH_TOKEN_MISSING');
  }


  return client;
}
