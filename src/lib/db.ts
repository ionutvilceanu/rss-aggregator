import { Pool } from 'pg';
import fs from 'fs';

// Centralizăm conexiunea la baza de date folosind DATABASE_URL (Aiven)
// Exemplu: postgres://avnadmin:password@host:10781/defaultdb?sslmode=require
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Missing DATABASE_URL environment variable for PostgreSQL connection');
}

// Preferăm SSL. Dacă avem certificat în env (PG_CA_CERT), îl folosim; altfel, nu refuzăm autoritatea
const caFromPath = (() => {
  const path = process.env.PG_CA_CERT_PATH;
  if (!path) return undefined;
  try {
    return fs.readFileSync(path, 'utf8');
  } catch (err) {
    console.warn('[db] PG_CA_CERT_PATH setat dar fișierul nu a putut fi citit:', path);
    return undefined;
  }
})();

// Fallback hardcoded CA pentru Aiven (dacă nu setăm prin env)
const AIVEN_CA_FALLBACK = `-----BEGIN CERTIFICATE-----\nMIIEUDCCArigAwIBAgIUP8szM2O5Mqt3joFvRwac5f3bTCUwDQYJKoZIhvcNAQEM\nBQAwQDE+MDwGA1UEAww1MmVmNGVjZDgtYWYyZi00YTkyLThhNTAtODU3N2MyZWQw\nMjI3IEdFTiAxIFByb2plY3QgQ0EwHhcNMjUwOTE1MDgyNjEzWhcNMzUwOTEzMDgy\nNjEzWjBAMT4wPAYDVQQDDDUyZWY0ZWNkOC1hZjJmLTRhOTItOGE1MC04NTc3YzJl\nZDAyMjcgR0VOIDEgUHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCC\nAYoCggGBANahT7MpyGXH+1tvVjT+8LwP+KHoYHMRqSoxKSk7pqviB3PCP99+ZDNa\nVH4Y6wqQ+nSvGHuEkbMm6C6ggKsZ5DZRPx8UhM4YFINoiH6FunFyQKllrRrUeyCZ\nfmZungdZRB61vz8ImXKYnxbLn9zUVfEwWwtcvaRkQZ9/uc/pM6oW/42DhCXuPaIF\nr3gjCB2G+BfqUel3KAtIRoqQosCAosSaFVrilS7AShE+HB6yI2DAks7oiJYeBSqf\nCjRT7+osQ2HwBpEE91Z3pmmrVdNf5WZLXmWZqciWnH956SJcT6hTX/BPw40pb1Sd\nzU1ut0Kf1uyvOWo3NJK0CR8BBpubmCn6MdIVGPYcTPM3Ora/UwN+GU9h7rwyfF/D\nTdZEHZqcYLluReNhXG1W/O1cjWoXEYvvBNnOAEYf/LXMLC6SZrLJfb070TVGtkoQ\nO0IMWOBWgfD/7Ok15pdA62p604FQRS6H3ybP22RIx3Ik+dZqF0gthu3k5mPl7ZC8\nC58xKMCAOwIDAQABo0IwQDAdBgNVHQ4EFgQUlYoJK8PJVZQ9rDg6VswGKsUpaFAw\nEgYDVR0TAQH/BAgwBgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQAD\nggGBAHJ67mF71pYFnHguy4rAIXHGEokTXJX/YbdJ6/3rZNIcj+VfsNUZDRCI+Ew4\n1oPCYMzseUYlMygu+YWl0qm+YBt7G9QDuz+ceVYkTrtiL+pbCYvkO6DLlZiEJOkh\nhR28TSBu1izSynDu/V2C50GnwWCmLb1QQ8F5zOYnO4vM2xDKpK/xH4qwY0bb4Not\nV9WFQVf6c3gX43XvRzyvdPFLMn1eSfWxq0za8AxA3IQtUdwZONQAS0XEBJyvDJqE\nZK7xB5bzTzUF0OMcO2kSttM+Toek0SoADGL5S6Go7hkEaz8uV0cY5E1UZXzbRBgq\nsjPLDsAZRwnxpMZ5gpFa/tlh/9bKt7+UEMeyEX6+C05Ian6NpgK9LadhxLaiJZIx\nJ/UB7dZpNC/pEhoITnJXlEUzbL3xilyRNh1tIbRidGs41tQXxIYPVxh1mfLSDPBf\nA+yAMazlVbkEnkBs4KSgFPzQ82QF4cz7xWxK3N7CC0UU9zj3gFx5W4x9HQ5Mi5jU\nnf+yUA==\n-----END CERTIFICATE-----\n`;

let caValue = process.env.PG_CA_CERT || caFromPath;
const isInsecureSsl = (process.env.PG_SSL_INSECURE || '').toLowerCase() === '1' || (process.env.PG_SSL_INSECURE || '').toLowerCase() === 'true';

// Determină automat dacă trebuie folosit SSL (Aiven necesită SSL)
let shouldUseSsl = false;
let isAivenHost = false;
try {
  const urlObj = new URL(connectionString);
  const sslParam = (urlObj.searchParams.get('sslmode') || '').toLowerCase();
  isAivenHost = urlObj.hostname.endsWith('.aivencloud.com');
  const nonDefaultPort = !!urlObj.port && urlObj.port !== '5432';
  shouldUseSsl = sslParam === 'require' || isAivenHost || nonDefaultPort || !!caValue || isInsecureSsl;
} catch {
  // dacă URL parsing eșuează, păstrăm fallback pe variabile
  shouldUseSsl = !!caValue || isInsecureSsl || connectionString.includes('sslmode=require');
}

// Dacă suntem pe Aiven și nu am primit CA din env/path, folosim fallback-ul hardcodat
if (shouldUseSsl && isAivenHost && !caValue) {
  caValue = AIVEN_CA_FALLBACK;
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