import { createMetaApiError } from './metaAuth';

type MetaConnectionPage<T> = {
  data?: T[];
  paging?: {
    next?: string;
  };
};

const MAX_META_CONNECTION_PAGES = 100;

export async function fetchAllMetaConnectionPages<T>(
  initialUrl: URL,
  fallbackMessage: string,
): Promise<T[]> {
  const items: T[] = [];
  const visitedUrls = new Set<string>();
  let nextUrl: string | undefined = initialUrl.toString();

  for (let page = 0; nextUrl && page < MAX_META_CONNECTION_PAGES; page += 1) {
    const url = new URL(nextUrl);

    if (url.protocol !== 'https:' || url.hostname !== 'graph.facebook.com') {
      throw new Error('Meta returned an invalid pagination URL');
    }

    if (visitedUrls.has(url.toString())) {
      throw new Error('Meta returned a repeated pagination URL');
    }
    visitedUrls.add(url.toString());

    const response = await fetch(url);
    const payload = await response.json() as MetaConnectionPage<T> & { error?: unknown };

    if (!response.ok) {
      throw createMetaApiError(payload, fallbackMessage);
    }

    if (Array.isArray(payload.data)) {
      items.push(...payload.data);
    }

    nextUrl = payload.paging?.next;
  }

  if (nextUrl) {
    throw new Error('Meta returned too many pages of results');
  }

  return items;
}

