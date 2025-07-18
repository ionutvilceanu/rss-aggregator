import { Pool } from 'pg';

const pool = new Pool({
  user: 'postgres',
  password: 'postgres',
  host: 'icsoft.go.ro',
  port: 5432, 
  database: 'newDB',
  ssl: false,
  application_name: 'rapidapp_nodejs'
});

export default pool; 