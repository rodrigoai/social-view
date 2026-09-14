/** @jest-environment node */
import { GET, PUT, POST, DELETE } from '@/app/api/settings/google-drive-service-account/route';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AuthzError } from '@/lib/authz';
import { encryptSecret } from '@/lib/appSecrets';
import { getConfiguredGoogleDriveClient, parseServiceAccountCredentials, testGoogleDriveCredentials } from '@/lib/googleDriveServiceAccount';

jest.mock('@/lib/prisma', () => ({ prisma: { appConfiguration: { findUnique: jest.fn(), upsert: jest.fn() } } }));
jest.mock('@/lib/authz', () => ({ ...jest.requireActual('@/lib/authz'), requireAdmin: jest.fn() }));
jest.mock('@/lib/appSecrets', () => ({ encryptSecret: jest.fn(() => 'encrypted-secret') }));
jest.mock('@/lib/googleDriveServiceAccount', () => ({
  parseServiceAccountCredentials: jest.fn(), testGoogleDriveCredentials: jest.fn(), getConfiguredGoogleDriveClient: jest.fn(),
}));

const credential = { type: 'service_account', project_id: 'project', private_key_id: 'key', private_key: 'private', client_email: 'drive@project.iam.gserviceaccount.com', token_uri: 'https://oauth2.googleapis.com/token' };

describe('global Google Drive service-account API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAdmin as jest.Mock).mockResolvedValue({ role: 'ADMIN' });
    (parseServiceAccountCredentials as jest.Mock).mockReturnValue(credential);
    (testGoogleDriveCredentials as jest.Mock).mockResolvedValue(undefined);
    (prisma.appConfiguration.upsert as jest.Mock).mockResolvedValue({ googleDriveClientEmail: credential.client_email, googleDriveProjectId: credential.project_id, googleDriveUpdatedAt: new Date('2026-09-11T12:00:00Z') });
  });

  it('returns only safe configuration metadata', async () => {
    (prisma.appConfiguration.findUnique as jest.Mock).mockResolvedValue({ googleDriveClientEmail: credential.client_email, googleDriveProjectId: credential.project_id, googleDriveUpdatedAt: new Date('2026-09-11T12:00:00Z'), googleDriveCredentialsEncrypted: 'must-not-leak' });
    const response = await GET();
    const body = await response.json();
    expect(body.config).toEqual({ configured: true, clientEmail: credential.client_email, projectId: 'project', updatedAt: '2026-09-11T12:00:00.000Z' });
    expect(JSON.stringify(body)).not.toContain('must-not-leak');
  });

  it('validates, tests and encrypts an uploaded JSON before saving', async () => {
    const form = new FormData();
    form.set('credentials', new File([JSON.stringify(credential)], 'service-account.json', { type: 'application/json' }));
    const response = await PUT(new Request('http://localhost/api/settings/google-drive-service-account', { method: 'PUT', body: form }));
    expect(response.status).toBe(200);
    expect(testGoogleDriveCredentials).toHaveBeenCalledWith(credential);
    expect(encryptSecret).toHaveBeenCalledWith(JSON.stringify(credential));
    expect(prisma.appConfiguration.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ googleDriveCredentialsEncrypted: 'encrypted-secret' }) }));
  });

  it('requires an administrator before reading or changing configuration', async () => {
    (requireAdmin as jest.Mock).mockRejectedValue(new AuthzError('Forbidden', 403));
    expect((await GET()).status).toBe(403);
    expect((await DELETE()).status).toBe(403);
    expect(prisma.appConfiguration.findUnique).not.toHaveBeenCalled();
  });

  it('tests the stored credential without returning it', async () => {
    const list = jest.fn().mockResolvedValue({ data: { files: [] } });
    (getConfiguredGoogleDriveClient as jest.Mock).mockResolvedValue({ files: { list } });
    expect((await POST()).status).toBe(200);
    expect(list).toHaveBeenCalled();
  });
});
