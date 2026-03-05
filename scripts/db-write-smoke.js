// Test de scriere în tabela articles pe baza Supabase
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Lipsește DATABASE_URL în .env.local');
  }

  let ssl = undefined;
  const caPath = process.env.PG_CA_CERT_PATH;
  const caInline = process.env.PG_CA_CERT;
  const insecure =
    (process.env.PG_SSL_INSECURE || '').toLowerCase() === '1' ||
    (process.env.PG_SSL_INSECURE || '').toLowerCase() === 'true';

  if (/sslmode=require/.test(connectionString) || caPath || caInline || insecure) {
    if (insecure) {
      ssl = { require: true, rejectUnauthorized: false };
    } else if (caPath && fs.existsSync(caPath)) {
      ssl = { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
    } else if (caInline) {
      ssl = { ca: caInline, rejectUnauthorized: true };
    } else {
      ssl = { require: true, rejectUnauthorized: false };
    }
  }

  return new Pool({ connectionString, ssl, application_name: 'newsion_write_test' });
}

(async () => {
  const pool = createPool();
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        source_url TEXT NOT NULL,
        pub_date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_manual BOOLEAN DEFAULT FALSE
      )
    `);

    const title = 'Test scriere Supabase ' + new Date().toISOString();
    const insert = await pool.query(
      `INSERT INTO articles (title, content, image_url, source_url, pub_date, is_manual)
       VALUES ($1, $2, $3, $4, NOW(), TRUE)
       RETURNING id`,
      [title, 'Continut test', null, 'local-test']
    );
    const count = await pool.query('SELECT COUNT(*)::int AS c FROM articles');
    console.log('Inserare OK, id=', insert.rows[0].id, 'Total articole=', count.rows[0].c);
  } catch (e) {
    console.error('Eroare scriere:', e.message);
    if (e.code) console.error('Code:', e.code);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();

