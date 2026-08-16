require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/payroll';
const { pool } = require('../src/config/database');

(async () => {
  try {
    const cols = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'schema_migrations'"
    );
    console.log('schema_migrations columns:', cols.rows);

    const migrations = await pool.query('SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 5');
    console.log('Last 5 migrations:', migrations.rows);

    const hasUpdatedAt = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'payroll_lines' AND column_name = 'updated_at'"
    );
    console.log('payroll_lines.updated_at exists:', hasUpdatedAt.rows.length > 0);
  } finally {
    await pool.end();
  }
})();
