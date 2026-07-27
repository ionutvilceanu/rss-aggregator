export const DEFAULT_ARTICLE_IMAGE = '/default.png';

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i;

export function isValidImageUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === DEFAULT_ARTICLE_IMAGE) return false;
  if (trimmed.startsWith('openrouter:') || trimmed.startsWith('prompt:')) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    // Exclude pagini web care nu sunt imagini
    if (!IMAGE_EXT.test(parsed.pathname) && !parsed.hostname.includes('img')) {
      // Permitem URL-uri fără extensie doar de la CDN-uri cunoscute
      const cdnHosts = [
        'cloudinary', 'imgur', 'wikimedia', 'dazn', 'gsp.ro', 'digisport', 'sport.ro',
        'fanatik', 'prosport', 'marca', 'gazzetta', 'espn', 'media.', 'static.', 'img.',
      ];
      if (!cdnHosts.some((h) => parsed.hostname.includes(h))) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function extractImageFromHtml(html?: string): string | null {
  if (!html) return null;

  const ogMatch =
    html.match(/property=["']og:image(?::url)?["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["'][^>]*property=["']og:image(?::url)?["']/i);
  if (ogMatch?.[1] && isValidImageUrl(ogMatch[1])) return ogMatch[1];

  const twitterMatch =
    html.match(/name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
  if (twitterMatch?.[1] && isValidImageUrl(twitterMatch[1])) return twitterMatch[1];

  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1] && isValidImageUrl(imgMatch[1])) return imgMatch[1];

  return null;
}

export function extractImageFromRssItem(item: {
  enclosure?: { url?: string; type?: string };
  content?: string;
  'media:content'?: { $?: { url?: string; medium?: string } } | { $?: { url?: string } }[];
  'media:thumbnail'?: { $?: { url?: string } } | { $?: { url?: string } }[];
}): string | null {
  if (item.enclosure?.url) {
    const type = item.enclosure.type || '';
    if (!type || type.startsWith('image/') || IMAGE_EXT.test(item.enclosure.url)) {
      if (isValidImageUrl(item.enclosure.url)) return item.enclosure.url;
    }
  }

  const mediaContent = item['media:content'];
  if (mediaContent) {
    const entries = Array.isArray(mediaContent) ? mediaContent : [mediaContent];
    for (const entry of entries) {
      const attrs = entry?.$ as { url?: string; medium?: string } | undefined;
      const url = attrs?.url;
      const medium = attrs?.medium;
      if (url && (!medium || medium === 'image') && isValidImageUrl(url)) return url;
    }
  }

  const mediaThumb = item['media:thumbnail'];
  if (mediaThumb) {
    const entries = Array.isArray(mediaThumb) ? mediaThumb : [mediaThumb];
    for (const entry of entries) {
      const url = entry?.$?.url;
      if (url && isValidImageUrl(url)) return url;
    }
  }

  return extractImageFromHtml(item.content || '');
}

async function fetchOgImageFromPage(articleUrl: string): Promise<string | null> {
  if (!articleUrl || articleUrl.includes('news.google.com')) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(articleUrl, {
      headers: {
        'User-Agent': 'SportAziBot/1.0 (+https://www.sportazi.ro)',
        Accept: 'text/html',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();
    return extractImageFromHtml(html);
  } catch {
    return null;
  }
}

export async function resolveArticleImage(
  sources: { imageUrl?: string; url: string }[],
  _title?: string
): Promise<string> {
  // 1. Imagini din RSS
  for (const source of sources) {
    if (source.imageUrl && isValidImageUrl(source.imageUrl)) {
      return source.imageUrl;
    }
  }

  // 2. og:image de pe pagina articolului (max 2 încercări)
  for (const source of sources.slice(0, 2)) {
    const ogImage = await fetchOgImageFromPage(source.url);
    if (ogImage) return ogImage;
  }

  // 3. Fallback local — funcționează pe local și Vercel (din public/)
  return DEFAULT_ARTICLE_IMAGE;
}
