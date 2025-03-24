import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

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
  const { id } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodă nepermisă' });
  }

  try {
    const result = await pool.query('SELECT * FROM articles WHERE id = $1', [id]);
    
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
    
    res.status(200).json(article);
  } catch (error) {
    console.error('Eroare la preluarea articolului:', error);
    res.status(500).json({ error: 'Eroare la preluarea articolului' });
  }
} 