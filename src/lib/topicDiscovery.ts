import Parser from 'rss-parser';
import { RSS_FEEDS, SPORT_KEYWORDS } from './rssFeeds';
import { extractImageFromRssItem } from './articleImages';

export type TopicSource = {
  title: string;
  snippet: string;
  url: string;
  imageUrl?: string;
  pubDate: Date;
  feedName: string;
};

export type TopicCandidate = {
  title: string;
  sources: TopicSource[];
  pubDate: Date;
  category: 'ro' | 'intl' | 'discovery';
  score: number;
};

const parser = new Parser({
  headers: {
    'User-Agent': 'SportAziBot/1.0 (+https://www.sportazi.ro)',
    'Cache-Control': 'no-cache',
  },
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
    ],
  },
});

const CACHE_TTL_MS = 10 * 60 * 1000;
let cachedItems: TopicSource[] | null = null;
let cacheTimestamp = 0;

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function normalizeTitle(title: string): string {
  let cleaned = decodeHtmlEntities(title).trim();
  // Elimină sufixul sursei: "Titlu - DigiSport"
  const parts = cleaned.split(' - ');
  if (parts.length > 1) {
    cleaned = parts.slice(0, -1).join(' - ').trim();
  }
  return cleaned;
}

function titleKey(title: string): string {
  return normalizeTitle(title)
    .toLowerCase()
    .replace(/[^\wăîâșț\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

async function fetchFeedItems(feed: (typeof RSS_FEEDS)[0]): Promise<TopicSource[]> {
  try {
    const feedData = await parser.parseURL(feed.url);
    return (feedData.items || [])
      .filter((item) => item.title && (item.link || item.guid))
      .map((item) => ({
        title: normalizeTitle(item.title || ''),
        snippet: stripHtml(item.contentSnippet || item.content || item.summary || '').slice(0, 500),
        url: item.link || item.guid || '',
        imageUrl: extractImageFromRssItem(item as Parameters<typeof extractImageFromRssItem>[0]) || undefined,
        pubDate: item.pubDate ? new Date(item.pubDate) : item.isoDate ? new Date(item.isoDate) : new Date(),
        feedName: feed.name,
      }))
      .filter((item) => item.title.length > 5);
  } catch (error) {
    console.warn(`Feed indisponibil (${feed.name}):`, (error as Error).message);
    return [];
  }
}

async function fetchAllFeedItems(): Promise<TopicSource[]> {
  const now = Date.now();
  if (cachedItems && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedItems;
  }

  const results = await Promise.all(RSS_FEEDS.map(fetchFeedItems));
  cachedItems = results.flat();
  cacheTimestamp = now;
  console.log(`Agregate ${cachedItems.length} iteme din ${RSS_FEEDS.length} feed-uri RSS`);
  return cachedItems;
}

function scoreItem(item: TopicSource, category: 'ro' | 'intl' | 'discovery'): number {
  let score = 0;
  const ageHours = (Date.now() - item.pubDate.getTime()) / (1000 * 60 * 60);

  // Recență: max 50 puncte (0h = 50, 24h+ = 0)
  score += Math.max(0, 50 - ageHours * 2);

  // Relevanță sport
  if (SPORT_KEYWORDS.test(item.title)) score += 30;
  if (SPORT_KEYWORDS.test(item.snippet)) score += 10;

  // Preferăm surse RO
  if (category === 'ro') score += 15;
  if (category === 'discovery') score += 5;

  return score;
}

function groupByTitle(items: TopicSource[]): Map<string, TopicSource[]> {
  const groups = new Map<string, TopicSource[]>();
  for (const item of items) {
    const key = titleKey(item.title);
    if (!key) continue;
    const existing = groups.get(key) || [];
    existing.push(item);
    groups.set(key, existing);
  }
  return groups;
}

export async function discoverTopics(count: number = 5): Promise<TopicCandidate[]> {
  const allItems = await fetchAllFeedItems();

  // Map feed name -> category
  const feedCategory = new Map(RSS_FEEDS.map((f) => [f.name, f.category]));

  const groups = groupByTitle(allItems);
  const candidates: TopicCandidate[] = [];

  for (const [, sources] of groups) {
    const primary = sources[0];
    const category = (feedCategory.get(primary.feedName) || 'discovery') as TopicCandidate['category'];
    const score = Math.max(...sources.map((s) => scoreItem(s, category)));

    if (score < 20) continue;

    candidates.push({
      title: primary.title,
      sources: sources.slice(0, 3),
      pubDate: new Date(Math.max(...sources.map((s) => s.pubDate.getTime()))),
      category,
      score,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, count);
}

export function formatTopicSources(topic: TopicCandidate): string {
  return topic.sources
    .map(
      (s, i) =>
        `SURSA ${i + 1}:\nTitlu: ${s.title}\nPublicație: ${s.feedName}\nDată: ${s.pubDate.toLocaleDateString('ro-RO')}\nURL: ${s.url}\nFragment: ${s.snippet || '(fără fragment)'}`
    )
    .join('\n\n');
}
