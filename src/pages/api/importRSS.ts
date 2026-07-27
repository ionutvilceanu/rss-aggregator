import type { NextApiRequest, NextApiResponse } from 'next';
import Parser from 'rss-parser';
import pool from '../../lib/db';
import { RSS_FEEDS } from '../../lib/rssFeeds';
import { DEFAULT_ARTICLE_IMAGE, extractImageFromRssItem } from '../../lib/articleImages';

const parser = new Parser({
  headers: {
    'User-Agent': 'SportAziBot/1.0 (+https://www.sportazi.ro)',
  },
});

const FEED_URLS = RSS_FEEDS.filter((f) => f.category !== 'discovery').map((f) => f.url);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verifica metoda HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodă nepermisă. Folosiți POST pentru această rută.' });
  }

  // Opțional: Adaugă o cheie API pentru securitate
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const expectedApiKey = process.env.CRON_API_KEY || 'secure_cron_key';
  
  if (apiKey !== expectedApiKey) {
    return res.status(401).json({ 
      error: 'Acces neautorizat. Api key invalidă sau lipsă.'
    });
  }

  try {
    // Asigură-te că tabela există
    await pool.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        source_url TEXT NOT NULL UNIQUE,
        pub_date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_manual BOOLEAN DEFAULT FALSE
      )
    `);
    
    // Adăugăm coloana is_manual dacă nu există
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name='articles'
        ) AND NOT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name='articles' AND column_name='is_manual'
        ) THEN
          ALTER TABLE articles ADD COLUMN is_manual BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;
    `);

    // Preluăm feed-urile în paralel
    console.log('Începerea preluării RSS feeds...');
    const feedPromises = FEED_URLS.map((feed) => {
      console.log(`Preluare din: ${feed}`);
      return parser.parseURL(feed).catch(error => {
        console.error(`Eroare la preluarea feed-ului ${feed}:`, error);
        return { items: [] }; // Întoarce un obiect gol în caz de eroare
      });
    });
    const feeds = await Promise.all(feedPromises);

    // Combinăm toate articolele într-un singur array
    const articles = feeds.flatMap((feed) =>
      feed.items ? feed.items.map((item) => ({
        title: item.title || '',
        link: item.link || '',
        pubDate: item.pubDate || new Date().toISOString(),
        image: extractImageFromRssItem(item as Parameters<typeof extractImageFromRssItem>[0]) || item.enclosure?.url || '',
        content: item.contentSnippet || item.content || '',
      })) : []
    );

    console.log(`Total articole preluate: ${articles.length}`);

    // Sortăm articolele din feed descrescător după dată
    const sortedFeedArticles = articles.sort((a, b) => {
      return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
    });

    // Salvăm articolele în baza de date (doar cele care nu există deja)
    let inserted = 0;
    let skipped = 0;

    for (const article of sortedFeedArticles) {
      const imageUrl = article.image && article.image !== '' ? article.image : DEFAULT_ARTICLE_IMAGE;

      try {
        // Verificăm mai întâi dacă articolul există deja
        const checkResult = await pool.query(
          'SELECT id FROM articles WHERE source_url = $1',
          [article.link]
        );

        if (checkResult.rows.length === 0) {
          // Articolul nu există, îl inserăm
          await pool.query(
            `INSERT INTO articles 
             (title, content, image_url, source_url, pub_date, is_manual) 
             VALUES ($1, $2, $3, $4, $5, false)`,
            [
              article.title,
              article.content,
              imageUrl,
              article.link,
              new Date(article.pubDate)
            ]
          );
          inserted++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.error('Eroare la inserarea articolului:', error);
        skipped++;
      }
    }

    res.status(200).json({
      message: `Import terminat. Articole noi: ${inserted}, articole sărite (deja existente): ${skipped}`,
      total: sortedFeedArticles.length
    });
  } catch (error) {
    console.error('Eroare la importul feed-urilor RSS:', error);
    res.status(500).json({ error: 'Eroare la importul feed-urilor RSS' });
  }
} 