import type { NextApiRequest, NextApiResponse } from 'next';
import Parser from 'rss-parser';

const parser = new Parser();

// Feed-urile pe care vrei să le agregi
const RSS_FEEDS = [
  'https://www.gazzetta.it/dynamic-feed/rss/section/last.xml',
  'https://e00-marca.uecdn.es/rss/portada.xml',
  'https://www.mundodeportivo.com/rss/home.xml',
];

// Funcția de traducere folosind Google Translate API
// Se folosește cheia și endpoint-ul furnizate.
// Observă că cererea trimite un array în formatul:
//    [[[textul], "auto", targetLang], "wt_lib"]
// iar răspunsul așteptat este de forma:
//    [[translatedText], [detectedLang]]
async function translateText(text: string, targetLang: "ro"): Promise<string> {
  if (!text) return '';

  try {
    const response = await fetch('https://translate-pa.googleapis.com/v1/translateHtml', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json+protobuf',
        'X-Goog-API-Key': 'AIzaSyATBXajvzQLTDHEQbcpq0Ihe0vWDHmO520'
      },
      body: JSON.stringify([[[text], 'auto', targetLang], 'wt_lib']),
    });

    const data = await response.json();
    // Se așteaptă ca data[0] să fie un array ce conține textul tradus
    return (data[0] && data[0][0]) || text;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Dacă apare o eroare, returnează textul original
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Fetching RSS feeds...');

  try {
    // 1. Preluăm feed-urile în paralel
    const feedPromises = RSS_FEEDS.map((feed) => parser.parseURL(feed));
    const feeds = await Promise.all(feedPromises);

    // 2. Combinăm toate articolele într-un singur array
    const articles = feeds.flatMap((feed) =>
      feed.items.map((item) => ({
        title: item.title || '',
        link: item.link || '',
        pubDate: item.pubDate || '',
        image: item.enclosure?.url || '',
        content: item.contentSnippet || item.content || '',
      }))
    );

    // 3. Sortăm articolele descrescător după dată
    articles.sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    // 4. Traducem titlul și conținutul pentru fiecare articol
    //    (Atenție la impactul de performanță!)
    const translatedArticles = await Promise.all(
      articles.map(async (article) => {
        const translatedTitle = await translateText(article.title, 'ro');
        const translatedContent = await translateText(article.content, 'ro');
        return {
          ...article,
          title: translatedTitle,
          content: translatedContent,
        };
      })
    );

    // 5. Răspundem cu articolele traduse
    res.status(200).json(translatedArticles);
  } catch (error) {
    console.error('Error fetching RSS feeds:', error);
    res.status(500).json({ error: 'Failed to fetch RSS feeds' });
  }
}
