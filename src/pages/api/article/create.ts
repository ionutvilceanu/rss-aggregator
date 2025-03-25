import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Acceptăm doar metoda POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodă nepermisă' });
  }

  try {
    // Verificăm și adăugăm coloana is_manual dacă nu există
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name='articles' AND column_name='is_manual'
        ) THEN
          ALTER TABLE articles ADD COLUMN is_manual BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;
    `);

    // Extragem datele articolului din request body
    const { title, content, imageUrl, sourceUrl } = req.body;
    
    // Validăm că avem cel puțin titlu și conținut
    if (!title || !content) {
      return res.status(400).json({ message: 'Titlul și conținutul sunt obligatorii' });
    }
    
    // Generăm data curentă pentru articolul nou
    const pubDate = new Date().toISOString();
    
    // Inserăm articolul în baza de date cu flag-ul is_manual setat la true
    const result = await pool.query(
      `INSERT INTO articles (title, content, image_url, source_url, pub_date, is_manual) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, content, imageUrl || null, sourceUrl || '', new Date(pubDate), true]
    );
    
    // Returnăm articolul creat
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Eroare la crearea articolului:', error);
    return res.status(500).json({ message: 'Eroare internă server' });
  }
} 