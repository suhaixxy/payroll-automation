// The team's docker-compose.yml has no healthcheck on the db service, so
// `docker compose up -d db` returns while Postgres is still starting up.
// Anything that touches the database right after that (migrations, seeds,
// the server itself) must poll for readiness instead of dying on the race.
// Handled here, on the UC-003 side, because the compose file is shared team
// infrastructure and must not be modified.

const { Pool } = require('pg');

const DEFAULT_URL = 'postgresql://postgres:postgres@localhost:5432/payroll_automation';

const ACTIONABLE_MESSAGE =
  'Cannot reach PostgreSQL at localhost:5432. Is Docker Desktop running? Try: npm run db:up';

/**
 * Polls the database with exponential backoff until it accepts a query,
 * or throws with an actionable message after ~timeoutMs.
 * @param {object} [options]
 * @param {number} [options.timeoutMs] - give up after this long (default 30s).
 * @param {(message: string) => void} [options.log] - progress logger.
 */
async function waitForDatabase({ timeoutMs = 30000, log = () => {} } = {}) {
  const connectionString = process.env.DATABASE_URL || DEFAULT_URL;
  const startedAt = Date.now();
  let delayMs = 250;
  let lastError = null;

  for (;;) {
    const pool = new Pool({ connectionString, connectionTimeoutMillis: 2000 });
    try {
      await pool.query('SELECT 1');
      await pool.end();
      return;
    } catch (err) {
      lastError = err;
      await pool.end().catch(() => {});
    }

    if (Date.now() - startedAt + delayMs >= timeoutMs) {
      throw new Error(`${ACTIONABLE_MESSAGE} (last error: ${lastError.message})`);
    }

    log(`PostgreSQL not ready yet (${lastError.message}) — retrying in ${delayMs}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(delayMs * 2, 3000);
  }
}

module.exports = { waitForDatabase, DEFAULT_URL, ACTIONABLE_MESSAGE };
