import { prisma } from '@/lib/prisma';
import { createMetaApiError } from '@/lib/metaAuth';

const INSTAGRAM_HISTORY_TIME_ZONE = 'America/Sao_Paulo';

type InstagramConfig = {
  igAccountId: string;
  igAccountName: string | null;
};

type FollowersHistoryEntry = {
  date: Date;
  followersCount: number;
  updatedAt?: Date | null;
};

export function getInstagramHistoryDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: INSTAGRAM_HISTORY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day)
  ));
}

export function serializeInstagramFollowersHistory(entries: FollowersHistoryEntry[]) {
  const entriesByDate = new Map<string, FollowersHistoryEntry>();

  for (const entry of entries) {
    const date = entry.date.toISOString().slice(0, 10);
    const existing = entriesByDate.get(date);
    const existingUpdatedAt = existing?.updatedAt?.getTime() ?? 0;
    const entryUpdatedAt = entry.updatedAt?.getTime() ?? 0;

    if (!existing || entryUpdatedAt >= existingUpdatedAt) {
      entriesByDate.set(date, entry);
    }
  }

  return Array.from(entriesByDate.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, entry]) => ({
      date,
      followers: entry.followersCount
    }));
}

export async function syncInstagramFollowers(
  config: InstagramConfig,
  accessToken: string,
  now = new Date()
) {
  const params = new URLSearchParams({
    fields: 'followers_count,media_count,username',
    access_token: accessToken
  });
  const accountRes = await fetch(
    `https://graph.facebook.com/v25.0/${config.igAccountId}?${params.toString()}`
  );
  const accountInfo = await accountRes.json();

  if (!accountRes.ok) {
    throw createMetaApiError(accountInfo, 'Failed to fetch Instagram account info');
  }

  const followers = accountInfo.followers_count || 0;
  const today = getInstagramHistoryDate(now);

  await prisma.instagramFollowersHistory.upsert({
    where: {
      igAccountId_date: {
        igAccountId: config.igAccountId,
        date: today
      }
    },
    update: {
      followersCount: followers
    },
    create: {
      igAccountId: config.igAccountId,
      date: today,
      followersCount: followers
    }
  });

  const historyStartDate = new Date(today);
  historyStartDate.setUTCDate(historyStartDate.getUTCDate() - 89);
  const history = await prisma.instagramFollowersHistory.findMany({
    where: {
      igAccountId: config.igAccountId,
      date: {
        gte: historyStartDate
      }
    },
    orderBy: {
      date: 'asc'
    }
  });

  return {
    accountInfo,
    followers,
    followersHistory: serializeInstagramFollowersHistory(history)
  };
}
