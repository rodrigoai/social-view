import { OAuth2Client } from 'google-auth-library';
import { prisma } from './prisma';

export function getGoogleOAuthClient(redirectUri?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID || 'dummy_client_id';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret';
  const resolvedRedirectUri = redirectUri
    || process.env.GOOGLE_REDIRECT_URI
    || 'http://localhost:3000/api/auth/google/callback';

  return new OAuth2Client(clientId, clientSecret, resolvedRedirectUri);
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
      const { credentials: tokens } = await client.refreshAccessToken();
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

/**
 * Explicitly refreshes tokens for a given account regardless of expiration state.
 * Useful when a 401 is received but our records thought the token was still valid.
 */
export async function refreshTokens(mainAccountId: string) {
  const credential = await prisma.googleCredential.findUnique({
    where: { mainAccountId }
  });

  if (!credential || !credential.refreshToken) {
    throw new Error('REFRESH_TOKEN_MISSING');
  }

  const client = getGoogleOAuthClient();
  client.setCredentials({
    refresh_token: credential.refreshToken,
  });

  console.log(`[googleAuth] Forcing token refresh for ${mainAccountId}...`);
  try {
    const { credentials: tokens } = await client.refreshAccessToken();
    
    await prisma.googleCredential.update({
      where: { mainAccountId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || credential.refreshToken,
        expiresAt: tokens.expiry_date,
      }
    });
    
    console.log(`[googleAuth] Force refresh successful for ${mainAccountId}`);
    return client;
  } catch (error: any) {
    console.error(`[googleAuth] Force refresh failed for ${mainAccountId}:`, error.message);
    throw new Error('REFRESH_FAILED');
  }
}

/**
 * High-level wrapper to execute Google API operations with automatic retry on 401.
 */
export async function withGoogleAuth<T>(
  mainAccountId: string, 
  operation: (client: OAuth2Client) => Promise<T>
): Promise<T> {
  let client = await getAuthorizedClient(mainAccountId);
  
  try {
    return await operation(client);
  } catch (error: any) {
    // Check if error is a 401 Unauthorized
    // For Google APIs, this usually manifests as an error with code 401 or a specific error message
    const isUnauthorized = 
      error.code === 401 || 
      error.status === 401 ||
      (error.response && error.response.status === 401) ||
      (error.message && error.message.toLowerCase().includes('unauthorized')) ||
      (error.message && error.message.toLowerCase().includes('invalid credentials'));

    if (isUnauthorized) {
      console.warn(`[googleAuth] Operation failed with 401 for ${mainAccountId}. Attempting refresh and retry...`);
      try {
        client = await refreshTokens(mainAccountId);
        // Retry the operation once with the new client
        return await operation(client);
      } catch (refreshError: any) {
        console.error(`[googleAuth] Retry failed after refresh for ${mainAccountId}:`, refreshError.message);
        throw error; // Throw original error if refresh or retry fails
      }
    }
    
    throw error;
  }
}
