import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import Parser from 'rss-parser';

const pool = new Pool({
  user: 'u_bcc35f30_277e_4a3a_9942_e1facdc13637',
  password: 'bOc6WvA75aor5gMtLm76q051Lz6HEy2Dp7qf6j0qO4O61uvG64a2',
  host: 'pg.rapidapp.io',
  port: 5433, // Observă că portul este 5433, nu 5432!
  database: 'db_bcc35f30_277e_4a3a_9942_e1facdc13637',
  ssl: { rejectUnauthorized: false },
  application_name: 'rapidapp_nodejs'
});

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
  const { id, url } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodă nepermisă' });
  }

  try {
    // Verificăm dacă avem un id sau un url
    if (id) {
      // Căutăm articolul după ID
      const result = await pool.query('SELECT id, title, content, image_url, source_url, pub_date, is_manual FROM articles WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Articol negăsit' });
      }
      
      // Verificăm dacă articolul este deja în română
      // Dacă nu, încercăm să îl traducem
      const article = result.rows[0];
      
      try {
        // Traducem conținutul dacă este nevoie
        if (article.title && !article.title.match(/^[a-zA-ZĂăÂâÎîȘșȚț0-9\s.,!?()-]+$/)) {
          article.title = await translateText(article.title, 'ro');
        }
        
        if (article.content && !article.content.match(/^[a-zA-ZĂăÂâÎîȘșȚț0-9\s.,!?()-]+$/)) {
          article.content = await translateText(article.content, 'ro');
          
          // Actualizăm articolul în baza de date cu traducerea
          await pool.query(
            'UPDATE articles SET title = $1, content = $2 WHERE id = $3',
            [article.title, article.content, id]
          );
        }
      } catch (translateError) {
        console.error('Eroare la traducerea articolului:', translateError);
        // Continuăm să returnăm articolul, chiar dacă traducerea a eșuat
      }
      
      return res.status(200).json(article);
    } else if (url) {
      // Este o cerere pentru un articol care nu a fost încă salvat
      // Verificăm dacă articolul există deja în baza de date
      const checkResult = await pool.query(
        'SELECT id, title, content, image_url, source_url, pub_date, is_manual FROM articles WHERE source_url = $1',
        [url]
      );
      
      if (checkResult.rows.length > 0) {
        // Articolul există deja, îl returnăm
        return res.status(200).json(checkResult.rows[0]);
      }
      
      // Articolul nu există, trebuie să îl preluăm din feed, să îl traducem și să îl salvăm
      try {
        const parser = new Parser();
        // Găsim sursa URL-ului și preluăm feed-ul
        const feed = await parser.parseURL(url.toString().split('/')[2]);
        
        // Căutăm articolul în feed
        const feedItem = feed.items.find(item => item.link === url);
        
        if (!feedItem) {
          return res.status(404).json({ error: 'Articol negăsit în feed' });
        }
        
        // Pregătim articolul
        const articleData = {
          title: feedItem.title || '',
          content: feedItem.contentSnippet || feedItem.content || '',
          image_url: feedItem.enclosure?.url || '',
          source_url: url.toString(),
          pub_date: feedItem.pubDate ? new Date(feedItem.pubDate) : new Date()
        };
        
        // Traducem articolul
        articleData.title = await translateText(articleData.title, 'ro');
        articleData.content = await translateText(articleData.content, 'ro');
        
        // Salvăm articolul în baza de date
        const result = await pool.query(
          `INSERT INTO articles (title, content, image_url, source_url, pub_date, is_manual) 
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [articleData.title, articleData.content, articleData.image_url, articleData.source_url, articleData.pub_date, false]
        );
        
        return res.status(200).json(result.rows[0]);
      } catch (error) {
        console.error('Eroare la preluarea și salvarea articolului:', error);
        return res.status(500).json({ error: 'Eroare la preluarea și salvarea articolului' });
      }
    } else {
      return res.status(400).json({ error: 'Lipsește ID-ul sau URL-ul articolului' });
    }
  } catch (error) {
    console.error('Eroare la preluarea articolului:', error);
    return res.status(500).json({ error: 'Eroare la preluarea articolului' });
  }
} 