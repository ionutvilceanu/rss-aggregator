import { Pool } from 'pg';

const pool = new Pool({
  user: 'u_bcc35f30_277e_4a3a_9942_e1facdc13637',
  password: 'bOc6WvA75aor5gMtLm76q051Lz6HEy2Dp7qf6j0qO4O61uvG64a2',
  host: 'pg.rapidapp.io',
  port: 5433, // Observă că portul este 5433, nu 5432!
  database: 'db_bcc35f30_277e_4a3a_9942_e1facdc13637',
  ssl: { rejectUnauthorized: false },
  application_name: 'rapidapp_nodejs'
});

export default pool; 