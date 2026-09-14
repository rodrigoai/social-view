/** @jest-environment node */
import { generateKeyPairSync } from 'node:crypto';
import { decryptSecret, encryptSecret } from '@/lib/appSecrets';
import { extractGoogleDriveFileId } from '@/lib/coyoTasks';
import { parseServiceAccountCredentials } from '@/lib/googleDriveServiceAccount';

jest.mock('@/lib/prisma', () => ({ prisma: {} }));

describe('application secrets and Google service-account validation', () => {
  const previousKey = process.env.APP_CONFIG_ENCRYPTION_KEY;
  beforeAll(() => { process.env.APP_CONFIG_ENCRYPTION_KEY = 'test-only-encryption-key-with-at-least-32-characters'; });
  afterAll(() => { if (previousKey === undefined) delete process.env.APP_CONFIG_ENCRYPTION_KEY; else process.env.APP_CONFIG_ENCRYPTION_KEY = previousKey; });

  it('encrypts authenticated ciphertext and decrypts it', () => {
    const encrypted = encryptSecret('private credential');
    expect(encrypted).not.toContain('private credential');
    expect(decryptSecret(encrypted)).toBe('private credential');
    expect(() => decryptSecret(`${encrypted.slice(0, -1)}x`)).toThrow();
  });

  it('accepts an original Google service-account JSON shape', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const credential = {
      type: 'service_account', project_id: 'socialview-test', private_key_id: 'new-key-id',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      client_email: 'drive@socialview-test.iam.gserviceaccount.com',
      token_uri: 'https://oauth2.googleapis.com/token',
    };
    expect(parseServiceAccountCredentials(JSON.stringify(credential))).toEqual(credential);
    expect(() => parseServiceAccountCredentials(JSON.stringify({ ...credential, token_uri: 'https://example.com/token' }))).toThrow('INVALID_SERVICE_ACCOUNT_TOKEN_URI');
  });

  it('extracts only supported Google Drive file identifiers', () => {
    expect(extractGoogleDriveFileId('https://taskmanager.coyo.com.br/api/drive/media?fileId=abc_123')).toBe('abc_123');
    expect(extractGoogleDriveFileId('https://drive.google.com/file/d/abc-123/view')).toBe('abc-123');
    expect(extractGoogleDriveFileId('https://drive.google.com/drive/u/0/folders/folder_123')).toBe('folder_123');
    expect(extractGoogleDriveFileId('https://docs.google.com/document/d/doc_123/edit')).toBe('doc_123');
    expect(extractGoogleDriveFileId('https://example.com/?fileId=secret')).toBeNull();
  });
});
