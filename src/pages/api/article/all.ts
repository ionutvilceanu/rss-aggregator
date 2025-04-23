import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodă nepermisă' });
  }

  try {
    const result = await pool.query(`
      SELECT id, title, content, image_url, source_url, pub_date, created_at, is_manual
      FROM articles 
      ORDER BY pub_date DESC
    `);

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Eroare la preluarea articolelor:', error);
    return res.status(500).json({ error: 'Eroare la preluarea articolelor' });
  }
} 