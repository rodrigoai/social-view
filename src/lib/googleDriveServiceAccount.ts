import { createPrivateKey } from 'node:crypto';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/appSecrets';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

export type GoogleServiceAccountCredentials = {
  type: 'service_account';
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id?: string;
  auth_uri?: string;
  token_uri: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
  universe_domain?: string;
};

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`INVALID_SERVICE_ACCOUNT_${field.toUpperCase()}`);
  return value.trim();
}

export function parseServiceAccountCredentials(value: string): GoogleServiceAccountCredentials {
  if (Buffer.byteLength(value, 'utf8') > 64 * 1024) throw new Error('SERVICE_ACCOUNT_FILE_TOO_LARGE');
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(value); } catch { throw new Error('INVALID_SERVICE_ACCOUNT_JSON'); }
  if (!parsed || Array.isArray(parsed) || parsed.type !== 'service_account') throw new Error('INVALID_SERVICE_ACCOUNT_TYPE');

  const credentials: GoogleServiceAccountCredentials = {
    type: 'service_account',
    project_id: requiredString(parsed.project_id, 'project_id'),
    private_key_id: requiredString(parsed.private_key_id, 'private_key_id'),
    private_key: typeof parsed.private_key === 'string' && parsed.private_key.trim() ? parsed.private_key : requiredString(parsed.private_key, 'private_key'),
    client_email: requiredString(parsed.client_email, 'client_email').toLowerCase(),
    token_uri: requiredString(parsed.token_uri, 'token_uri'),
  };
  if (!credentials.client_email.endsWith('.iam.gserviceaccount.com')) throw new Error('INVALID_SERVICE_ACCOUNT_CLIENT_EMAIL');
  if (credentials.token_uri !== 'https://oauth2.googleapis.com/token') throw new Error('INVALID_SERVICE_ACCOUNT_TOKEN_URI');
  try { createPrivateKey(credentials.private_key); } catch { throw new Error('INVALID_SERVICE_ACCOUNT_PRIVATE_KEY'); }
  return credentials;
}

export function createGoogleDriveClient(credentials: GoogleServiceAccountCredentials) {
  const auth = new google.auth.GoogleAuth({ credentials, scopes: [DRIVE_SCOPE] });
  return google.drive({ version: 'v3', auth });
}

export async function testGoogleDriveCredentials(credentials: GoogleServiceAccountCredentials) {
  const drive = createGoogleDriveClient(credentials);
  await drive.files.list({ pageSize: 1, fields: 'files(id)', supportsAllDrives: true });
}

export async function getConfiguredGoogleDriveClient() {
  const config = await prisma.appConfiguration.findUnique({ where: { id: 'global' }, select: { googleDriveCredentialsEncrypted: true } });
  if (!config?.googleDriveCredentialsEncrypted) throw new Error('GOOGLE_DRIVE_NOT_CONFIGURED');
  const credentials = parseServiceAccountCredentials(decryptSecret(config.googleDriveCredentialsEncrypted));
  return createGoogleDriveClient(credentials);
}
