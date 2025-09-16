import { Pool } from 'pg';
import fs from 'fs';

// Centralizăm conexiunea la baza de date folosind DATABASE_URL (Aiven)
// Exemplu: postgres://avnadmin:password@host:10781/defaultdb?sslmode=require
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Missing DATABASE_URL environment variable for PostgreSQL connection');
}

// Preferăm SSL. Dacă avem certificat în env (PG_CA_CERT), îl folosim; altfel, nu refuzăm autoritatea
const caFromPath = process.env.PG_CA_CERT_PATH
  ? fs.readFileSync(process.env.PG_CA_CERT_PATH, 'utf8')
  : undefined;

const caValue = process.env.PG_CA_CERT || caFromPath;
const isInsecureSsl = (process.env.PG_SSL_INSECURE || '').toLowerCase() === '1' || (process.env.PG_SSL_INSECURE || '').toLowerCase() === 'true';

// Determină automat dacă trebuie folosit SSL (Aiven necesită SSL)
let shouldUseSsl = false;
try {
  const urlObj = new URL(connectionString);
  const sslParam = (urlObj.searchParams.get('sslmode') || '').toLowerCase();
  const isAiven = urlObj.hostname.endsWith('.aivencloud.com');
  const nonDefaultPort = !!urlObj.port && urlObj.port !== '5432';
  shouldUseSsl = sslParam === 'require' || isAiven || nonDefaultPort || !!caValue || isInsecureSsl;
} catch {
  // dacă URL parsing eșuează, păstrăm fallback pe variabile
  shouldUseSsl = !!caValue || isInsecureSsl || connectionString.includes('sslmode=require');
}

const sslOption: any = shouldUseSsl
  ? (isInsecureSsl
      ? { rejectUnauthorized: false }
      : (caValue
          ? { ca: Array.isArray(caValue) ? caValue : [caValue], rejectUnauthorized: true }
          : { rejectUnauthorized: false }))
  : undefined;

const pool = new Pool({
  connectionString,
  ssl: sslOption,
  application_name: 'newsion_app'
});

export default pool;