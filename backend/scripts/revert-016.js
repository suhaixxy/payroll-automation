require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/payroll';
const { pool } = require('../src/config/database');

(async () => {
  await pool.query("DELETE FROM schema_migrations WHERE filename = '016_uc003_line_resolution.sql'");
  console.log('Reverted 016_uc003_line_resolution.sql from schema_migrations');
  await pool.end();
})();
