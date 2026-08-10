// Applies the raw SQL files in db/migrations in filename order, recording
// each applied file in a schema_migrations table so re-runs skip them.
// Called once at server startup (and by tests) — safe to run repeatedly.

const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

// These migrations shipped before this runner existed, so on the team's
// current databases the tables are already there but schema_migrations is
// not. Re-running 001 would crash on "CREATE TABLE staff" (already exists),
// so when we detect that situation we record these as applied instead of
// executing them. A brand-new/empty database still runs them for real.
const PRE_RUNNER_BASELINE = [
  '001_initial_schema.sql',
  '002_uc001_enhancements.sql',
  '003_shift_times.sql',
];

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `);

  const { rows: appliedRows } = await pool.query(`SELECT filename FROM schema_migrations`);
  const applied = new Set(appliedRows.map((row) => row.filename));

  if (applied.size === 0) {
    const { rows } = await pool.query(`SELECT to_regclass('public.pay_period') AS existing`);
    if (rows[0].existing) {
      for (const filename of PRE_RUNNER_BASELINE) {
        await pool.query(
          `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
          [filename]
        );
        applied.add(filename);
      }
    }
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();

  for (const filename of files) {
    if (applied.has(filename)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');

    // Each migration runs in its own transaction so a broken one leaves the
    // database exactly as it was, instead of half-applied.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [filename]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${filename} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }
}

module.exports = { initializeDatabase };
