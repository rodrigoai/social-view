import { OAuth2Client } from 'google-auth-library';

export function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID || 'dummy_client_id';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

  return new OAuth2Client(clientId, clientSecret, redirectUri);
}
