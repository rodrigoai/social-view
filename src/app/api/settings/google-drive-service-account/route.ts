import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authzErrorResponse, requireAdmin } from '@/lib/authz';
import { encryptSecret } from '@/lib/appSecrets';
import { getConfiguredGoogleDriveClient, parseServiceAccountCredentials, testGoogleDriveCredentials } from '@/lib/googleDriveServiceAccount';

function publicConfig(config: { googleDriveClientEmail: string | null; googleDriveProjectId: string | null; googleDriveUpdatedAt: Date | null } | null) {
  return {
    configured: Boolean(config?.googleDriveClientEmail),
    clientEmail: config?.googleDriveClientEmail || null,
    projectId: config?.googleDriveProjectId || null,
    updatedAt: config?.googleDriveUpdatedAt?.toISOString() || null,
  };
}

function configurationError(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  const messages: Record<string, string> = {
    INVALID_SERVICE_ACCOUNT_JSON: 'Choose the original JSON file downloaded from Google Cloud.',
    INVALID_SERVICE_ACCOUNT_TYPE: 'The JSON must contain a Google service account credential.',
    INVALID_SERVICE_ACCOUNT_CLIENT_EMAIL: 'The service account email is invalid.',
    INVALID_SERVICE_ACCOUNT_TOKEN_URI: 'The credential does not use Google’s expected token endpoint.',
    INVALID_SERVICE_ACCOUNT_PRIVATE_KEY: 'The service account private key is invalid.',
    SERVICE_ACCOUNT_FILE_TOO_LARGE: 'The service account file is unexpectedly large.',
    APP_CONFIG_ENCRYPTION_KEY_MISSING: 'Configure APP_CONFIG_ENCRYPTION_KEY on the server before saving credentials.',
  };
  if (messages[code] || code.startsWith('INVALID_SERVICE_ACCOUNT_')) return NextResponse.json({ error: messages[code] || 'The service account credential is incomplete.' }, { status: 400 });
  return null;
}

export async function GET() {
  try {
    await requireAdmin();
    const config = await prisma.appConfiguration.findUnique({
      where: { id: 'global' },
      select: { googleDriveClientEmail: true, googleDriveProjectId: true, googleDriveUpdatedAt: true },
    });
    return NextResponse.json({ config: publicConfig(config) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return authzErrorResponse(error) || NextResponse.json({ error: 'Unable to load the Google Drive configuration.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const formData = await request.formData();
    const file = formData.get('credentials');
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Choose a Google service account JSON file.' }, { status: 400 });
    if (file.size > 64 * 1024) return NextResponse.json({ error: 'The service account file is unexpectedly large.' }, { status: 400 });
    const raw = await file.text();
    const credentials = parseServiceAccountCredentials(raw);
    await testGoogleDriveCredentials(credentials);
    const now = new Date();
    const encryptedCredentials = encryptSecret(JSON.stringify(credentials));
    const config = await prisma.appConfiguration.upsert({
      where: { id: 'global' },
      update: {
        googleDriveCredentialsEncrypted: encryptedCredentials,
        googleDriveClientEmail: credentials.client_email,
        googleDriveProjectId: credentials.project_id,
        googleDrivePrivateKeyId: credentials.private_key_id,
        googleDriveUpdatedAt: now,
      },
      create: {
        id: 'global',
        googleDriveCredentialsEncrypted: encryptedCredentials,
        googleDriveClientEmail: credentials.client_email,
        googleDriveProjectId: credentials.project_id,
        googleDrivePrivateKeyId: credentials.private_key_id,
        googleDriveUpdatedAt: now,
      },
      select: { googleDriveClientEmail: true, googleDriveProjectId: true, googleDriveUpdatedAt: true },
    });
    return NextResponse.json({ config: publicConfig(config) });
  } catch (error) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    const invalidResponse = configurationError(error);
    if (invalidResponse) return invalidResponse;
    return NextResponse.json({ error: 'Google rejected the credential. Confirm that the Drive API is enabled and generate a fresh JSON key.' }, { status: 400 });
  }
}

export async function POST() {
  try {
    await requireAdmin();
    const drive = await getConfiguredGoogleDriveClient();
    await drive.files.list({ pageSize: 1, fields: 'files(id)', supportsAllDrives: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    const code = error instanceof Error ? error.message : '';
    if (code === 'GOOGLE_DRIVE_NOT_CONFIGURED') return NextResponse.json({ error: 'Upload a service account JSON file first.' }, { status: 400 });
    if (code === 'APP_CONFIG_ENCRYPTION_KEY_MISSING' || code === 'INVALID_ENCRYPTED_SECRET') return NextResponse.json({ error: 'The saved credential cannot be decrypted. Upload it again.' }, { status: 503 });
    return NextResponse.json({ error: 'Google Drive connection failed. Confirm the key is active and the Drive API is enabled.' }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    await requireAdmin();
    await prisma.appConfiguration.upsert({
      where: { id: 'global' },
      update: {
        googleDriveCredentialsEncrypted: null,
        googleDriveClientEmail: null,
        googleDriveProjectId: null,
        googleDrivePrivateKeyId: null,
        googleDriveUpdatedAt: null,
      },
      create: { id: 'global' },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return authzErrorResponse(error) || NextResponse.json({ error: 'Unable to remove the Google Drive configuration.' }, { status: 500 });
  }
}
