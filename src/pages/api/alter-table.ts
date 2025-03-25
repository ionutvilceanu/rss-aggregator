import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Adăugăm coloana is_manual dacă nu există
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
    
    return res.status(200).json({ message: 'Tabelul a fost actualizat cu succes' });
  } catch (error) {
    console.error('Eroare la actualizarea tabelului:', error);
    return res.status(500).json({ message: 'Eroare la actualizarea tabelului', error });
  }
} 