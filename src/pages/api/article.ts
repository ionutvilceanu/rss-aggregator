import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import Parser from 'rss-parser';

const pool = new Pool({
  user: 'postgres',
  password: 'postgres',
  host: 'icsoft.go.ro',
  port: 5432,
  database: 'newDB',
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
  const { url } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodă nepermisă' });
  }

  if (!url) {
    return res.status(400).json({ error: 'Lipsește URL-ul articolului' });
  }

  try {
    // Verificăm dacă articolul există deja în baza de date
    const checkResult = await pool.query(
      'SELECT * FROM articles WHERE source_url = $1',
      [url]
    );
    
    if (checkResult.rows.length > 0) {
      // Articolul există deja, îl returnăm
      return res.status(200).json(checkResult.rows[0]);
    }
    
    // Articolul nu există, trebuie să îl preluăm, să îl traducem și să îl salvăm
    try {
      const parser = new Parser();
      let feedUrl;
      
      // Extragem domeniul din URL
      const urlObj = new URL(url as string);
      const domain = urlObj.hostname;
      
      // Găsim feed-ul potrivit pentru acest domeniu
      if (domain === 'www.gazzetta.it') {
        feedUrl = 'https://www.gazzetta.it/dynamic-feed/rss/section/last.xml';
      } else if (domain === 'e00-marca.uecdn.es' || domain.includes('marca')) {
        feedUrl = 'https://e00-marca.uecdn.es/rss/portada.xml';
      } else if (domain === 'www.mundodeportivo.com') {
        feedUrl = 'https://www.mundodeportivo.com/rss/home.xml';
      } else {
        // Încercăm să ghicim feed-ul
        feedUrl = `https://${domain}/rss/home.xml`;
      }
      
      // Preluăm feed-ul
      console.log(`Încercăm să preluăm feed-ul: ${feedUrl}`);
      const feed = await parser.parseURL(feedUrl);
      
      // Căutăm articolul în feed după URL
      let feedItem = feed.items.find(item => item.link === url);
      
      // Dacă nu găsim match exact, încercăm să verificăm dacă articolul conține URL-ul parțial
      if (!feedItem) {
        feedItem = feed.items.find(item => {
          if (!item.link) return false;
          // Verificăm dacă URL-ul articolului conține path-ul din URL-ul cerut
          const itemPath = new URL(item.link).pathname;
          const requestedPath = urlObj.pathname;
          return itemPath.includes(requestedPath) || requestedPath.includes(itemPath);
        });
      }
      
      if (!feedItem) {
        // Dacă tot nu-l găsim, răspundem cu eroare
        return res.status(404).json({ error: 'Articol negăsit în feed' });
      }
      
      // Pregătim articolul
      const articleData = {
        title: feedItem.title || '',
        content: feedItem.contentSnippet || feedItem.content || '',
        image_url: feedItem.enclosure?.url || '',
        source_url: url as string,
        pub_date: feedItem.pubDate ? new Date(feedItem.pubDate) : new Date()
      };
      
      // Traducem articolul
      articleData.title = await translateText(articleData.title, 'ro');
      articleData.content = await translateText(articleData.content, 'ro');
      
      // Salvăm articolul în baza de date
      const result = await pool.query(
        `INSERT INTO articles (title, content, image_url, source_url, pub_date) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [articleData.title, articleData.content, articleData.image_url, articleData.source_url, articleData.pub_date]
      );
      
      return res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error('Eroare la preluarea și salvarea articolului:', error);
      return res.status(500).json({ error: 'Eroare la preluarea și salvarea articolului: ' + (error as Error).message });
    }
  } catch (error) {
    console.error('Eroare la preluarea articolului:', error);
    return res.status(500).json({ error: 'Eroare la preluarea articolului: ' + (error as Error).message });
  }
} 