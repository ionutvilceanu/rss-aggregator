import type { NextApiRequest, NextApiResponse } from 'next';
import Parser from 'rss-parser';
import pool from '../../lib/db';

const parser = new Parser();

// Feed-urile pe care vrei să le agregi
const RSS_FEEDS = [
  'https://www.gazzetta.it/dynamic-feed/rss/section/last.xml',
  'https://e00-marca.uecdn.es/rss/portada.xml',
  'https://www.mundodeportivo.com/rss/home.xml',
];

// Funcția de traducere folosind Google Translate API
async function translateText(text: string, targetLang: string): Promise<string> {
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

    if (!response.ok) {
      console.error('Eroare traducere, status:', response.status);
      return text;
    }

    const data = await response.json();
    return (data[0] && data[0][0]) || text;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Dacă apare o eroare, returnează textul original
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 1. Create the articles table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        source_url TEXT NOT NULL,
        pub_date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Preluăm feed-urile în paralel
    const feedPromises = RSS_FEEDS.map((feed) => parser.parseURL(feed));
    const feeds = await Promise.all(feedPromises);

    // 3. Combinăm toate articolele într-un singur array
    const articles = feeds.flatMap((feed) =>
      feed.items.map((item) => ({
        title: item.title || '',
        link: item.link || '',
        pubDate: item.pubDate || '',
        image: item.enclosure?.url || '',
        content: item.contentSnippet || item.content || '',
      }))
    );

    // 4. Sortăm articolele descrescător după dată
    articles.sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    // 5. Traducem titlul și conținutul pentru fiecare articol
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

    // 6. Salvăm articolele traduse în baza de date
    const savedArticles = await Promise.all(
      translatedArticles.map(async (article) => {
        try {
          // Verificăm dacă articolul există deja
          const checkResult = await pool.query(
            'SELECT id FROM articles WHERE source_url = $1',
            [article.link]
          );
          
          if (checkResult.rows.length > 0) {
            // Articolul există deja, returnăm ID-ul existent
            return { ...article, id: checkResult.rows[0].id };
          }
          
          // Inserăm articolul nou
          const result = await pool.query(
            `INSERT INTO articles (title, content, image_url, source_url, pub_date) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [article.title, article.content, article.image, article.link, new Date(article.pubDate)]
          );
          
          // Returnăm articolul cu ID-ul nou
          return { ...article, id: result.rows[0].id };
        } catch (error) {
          console.error('Error saving article:', error);
          return article; // Returnăm articolul fără ID în caz de eroare
        }
      })
    );

    // 7. Răspundem cu articolele traduse și salvate
    res.status(200).json(savedArticles);
  } catch (error) {
    console.error('Eroare la preluarea feed-urilor RSS:', error);
    res.status(500).json({ error: 'Eroare la preluarea feed-urilor RSS' });
  }
}
