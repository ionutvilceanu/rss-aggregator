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

    // Ștergem articolul
    await db.query('DELETE FROM articles WHERE id = $1', [id]);

    // Returnăm un răspuns de succes
    return res.status(200).json({ message: 'Articolul a fost șters cu succes' });
  } catch (error) {
    console.error('Eroare la ștergerea articolului:', error);
    return res.status(500).json({ message: 'Eroare la ștergerea articolului' });
  }
} 