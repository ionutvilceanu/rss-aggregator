import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Permitem doar metoda DELETE
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Metoda nu este permisă' });
  }

  // Securizare simplă cu API key
  const apiKey = (req.headers['x-api-key'] as string) || (req.query.apiKey as string);
  const expectedApiKey = process.env.ADMIN_API_KEY || process.env.CRON_API_KEY || 'secure_cron_key';
  if (!apiKey || apiKey !== expectedApiKey) {
    return res.status(401).json({ message: 'Acces neautorizat' });
  }

  // Extragem ID-ul articolului din query sau body
  const id = req.query.id || req.body.id;
  
  if (!id) {
    return res.status(400).json({ message: 'ID-ul articolului este necesar' });
  }

  try {
    // Verificăm dacă articolul există
    const result = await db.query('SELECT id FROM articles WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Articolul nu a fost găsit' });
    }

    // Soft-delete dacă există coloana is_deleted, altfel hard-delete
    await db.query(
      `DO $$
       BEGIN
         IF EXISTS (
           SELECT FROM information_schema.columns 
           WHERE table_name='articles' AND column_name='is_deleted'
         ) THEN
           UPDATE articles SET is_deleted = TRUE WHERE id = $1;
         ELSE
           DELETE FROM articles WHERE id = $1;
         END IF;
       END $$;`,
      [id]
    );

    // Returnăm un răspuns de succes
    return res.status(200).json({ message: 'Articolul a fost eliminat' });
  } catch (error) {
    console.error('Eroare la eliminarea articolului:', error);
    return res.status(500).json({ message: 'Eroare la eliminarea articolului' });
  }
} 