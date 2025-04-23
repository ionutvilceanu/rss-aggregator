// Conectarea la baza de date
const { Pool } = require('pg');

const pool = new Pool({
  user: 'u_bcc35f30_277e_4a3a_9942_e1facdc13637',
  password: 'bOc6WvA75aor5gMtLm76q051Lz6HEy2Dp7qf6j0qO4O61uvG64a2',
  host: 'pg.rapidapp.io',
  port: 5433,
  database: 'db_bcc35f30_277e_4a3a_9942_e1facdc13637',
  ssl: { rejectUnauthorized: false },
  application_name: 'rapidapp_nodejs'
});

async function main() {
  try {
    console.log('Inițierea procesului de verificare și reparare a articolelor...');
    
    // 1. Verifică câte articole sunt în baza de date
    const countResult = await pool.query('SELECT COUNT(*) FROM articles');
    const totalArticles = parseInt(countResult.rows[0].count);
    console.log(`Total articole în baza de date: ${totalArticles}`);
    
    // 2. Verifică integritatea datelor - dacă există articole cu probleme
    const articlesResult = await pool.query(`
      SELECT id, title, content, image_url, source_url, pub_date, created_at, is_manual
      FROM articles 
      ORDER BY pub_date DESC
      LIMIT 10
    `);
    
    console.log(`Ultimele ${articlesResult.rows.length} articole din baza de date:`);
    articlesResult.rows.forEach(article => {
      console.log(`ID: ${article.id}, Titlu: ${article.title.substring(0, 50)}..., Data: ${article.pub_date}`);
    });
    
    // 3. Restaurează indexarea pentru a optimiza performanța după modificări
    await pool.query(`
      REINDEX TABLE articles;
    `);
    console.log('Indexurile pentru tabela articles au fost reindexate.');
    
    console.log('Procesul de verificare și reparare a articolelor a fost finalizat cu succes!');
    await pool.end();
  } catch (error) {
    console.error('Eroare în timpul procesului de reparare:', error);
    process.exit(1);
  }
}

main(); 