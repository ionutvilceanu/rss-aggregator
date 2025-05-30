import type { NextApiRequest, NextApiResponse } from 'next';
import Parser from 'rss-parser';
import pool from '../../lib/db';

const parser = new Parser();

// Feed-urile pe care vrei să le agregi
const RSS_FEEDS = [
  'https://www.gazzetta.it/dynamic-feed/rss/section/last.xml',
  'https://e00-marca.uecdn.es/rss/portada.xml',
  'https://www.mundodeportivo.com/rss/home.xml'
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
    // Parametri de paginare
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const skip = (page - 1) * limit;

    // 1. Create the articles table if it doesn't exist (păstrăm asta pentru prima execuție)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        source_url TEXT NOT NULL,
        pub_date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_manual BOOLEAN DEFAULT FALSE
      )
    `);
    
    // Adăugăm coloana is_manual dacă tabela există deja și nu are coloana
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

    // MODIFICAT: Nu mai preluăm feed-urile RSS direct
    // Acum preluăm doar articolele din baza de date
    
    // 5. Preluăm articolele din baza de date - specificăm exact coloanele pentru a evita erori cu coloane eliminate
    const articlesQueryResult = await pool.query(`
      SELECT id, title, content, image_url, source_url, pub_date, created_at, is_manual
      FROM articles 
      ORDER BY pub_date DESC 
      LIMIT $1 OFFSET $2
    `, [limit, skip]);
    
    // 6. Numărul total de articole pentru paginare
    const totalCountResult = await pool.query('SELECT COUNT(*) FROM articles');
    const totalArticles = parseInt(totalCountResult.rows[0].count);

    // 7. Transformăm rezultatele în formatul așteptat
    const dbArticles = articlesQueryResult.rows.map(row => ({
      id: row.id,
      title: row.title,
      link: row.source_url,
      pubDate: row.pub_date,
      image: row.image_url,
      content: row.content,
      is_manual: row.is_manual
    }));

    // 10. Răspundem cu articolele și informații de paginare
    res.status(200).json({
      articles: dbArticles,
      pagination: {
        total: totalArticles,
        page,
        limit,
        pages: Math.ceil(totalArticles / limit)
      }
    });
  } catch (error) {
    console.error('Eroare la preluarea feed-urilor RSS:', error);
    res.status(500).json({ error: 'Eroare la preluarea feed-urilor RSS' });
  }
}
