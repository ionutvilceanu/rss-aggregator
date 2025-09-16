// Test conexiune PostgreSQL (Aiven) cu CA
require('dotenv').config({ path: '.env.local' });
// Forțăm DNS public pentru a evita probleme locale de rezolvare
try {
  const dns = require('dns');
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}
const fs = require('fs');
const { Pool } = require('pg');

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Lipsește DATABASE_URL în .env.local');
  }

  let ssl = undefined;
  const caPath = process.env.PG_CA_CERT_PATH;
  const caInline = process.env.PG_CA_CERT;
  const insecure = (process.env.PG_SSL_INSECURE || '').toLowerCase() === '1' || (process.env.PG_SSL_INSECURE || '').toLowerCase() === 'true';
  if (/sslmode=require/.test(connectionString) || caPath || caInline || insecure) {
    if (insecure) {
      ssl = { rejectUnauthorized: false };
    } else if (caPath && fs.existsSync(caPath)) {
      ssl = { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
    } else if (caInline) {
      ssl = { ca: caInline, rejectUnauthorized: true };
    } else {
      ssl = { rejectUnauthorized: false };
    }
  }

  return new Pool({ connectionString, ssl, application_name: 'newsion_test' });
}

(async () => {
  const pool = createPool();
  const start = Date.now();
  try {
    const version = await pool.query('select version()');
    const now = await pool.query('select now() as now');
    const one = await pool.query('select 1 as ok');
    console.log('Conexiune OK');
    console.log('Server version:', version.rows[0].version);
    console.log('Server time:', now.rows[0].now);
    console.log('Smoke test:', one.rows[0]);
  } catch (e) {
    console.error('Eșec conexiune:', e.message);
    if (e.code) console.error('Code:', e.code);
  } finally {
    await pool.end();
    console.log('Durata:', Date.now() - start, 'ms');
  }
})();


