import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const CONTEXT = Buffer.from('socialview:app-configuration:v1');

function encryptionKey() {
  const source = process.env.APP_CONFIG_ENCRYPTION_KEY || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!source || source.length < 32) throw new Error('APP_CONFIG_ENCRYPTION_KEY_MISSING');
  return createHash('sha256').update(source).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(CONTEXT);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptSecret(value: string) {
  const [version, iv, authTag, encrypted] = value.split('.');
  if (version !== 'v1' || !iv || !authTag || !encrypted) throw new Error('INVALID_ENCRYPTED_SECRET');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAAD(CONTEXT);
  decipher.setAuthTag(Buffer.from(authTag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}
