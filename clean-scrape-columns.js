// Conectarea la baza de date
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  application_name: 'newsion_app'
});

async function main() {
  try {
    // Obținem lista completă a coloanelor pentru a vedea ce există
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'articles'
    `);
    
    console.log('Coloanele existente în tabela articles:');
    columnsResult.rows.forEach(row => {
      console.log(row.column_name);
    });
    
    // Eliminăm coloanele identificate din screenshot
    const removeScrapeColumns = await pool.query(`
      DO $$
      BEGIN
        -- Eliminăm coloanele adăugate pentru scrape
        IF EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name='articles' AND column_name='ai_rewritten'
        ) THEN
          ALTER TABLE articles DROP COLUMN ai_rewritten;
          RAISE NOTICE 'Coloana ai_rewritten a fost eliminată cu succes';
        END IF;
        
        IF EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name='articles' AND column_name='rewritten_content'
        ) THEN
          ALTER TABLE articles DROP COLUMN rewritten_content;
          RAISE NOTICE 'Coloana rewritten_content a fost eliminată cu succes';
        END IF;
        
        IF EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name='articles' AND column_name='full_content'
        ) THEN
          ALTER TABLE articles DROP COLUMN full_content;
          RAISE NOTICE 'Coloana full_content a fost eliminată cu succes';
        END IF;
      END $$;
    `);
    
    console.log('Coloanele ai_rewritten, rewritten_content și full_content au fost eliminate (dacă existau).');
    
    await pool.end();
    
    console.log('Operațiune finalizată cu succes!');
  } catch (error) {
    console.error('Eroare:', error);
  }
}

main(); 