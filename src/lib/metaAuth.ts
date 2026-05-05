import { env } from 'process';

const META_APP_ID = env.META_APP_ID || process.env.META_APP_ID;
const META_APP_SECRET = env.META_APP_SECRET || process.env.META_APP_SECRET;

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
