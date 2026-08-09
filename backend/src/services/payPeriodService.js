// Shared pay-period concept (used by UC-001 onward). Bulk generation is an
// explicit bootstrap option; normal startup leaves database-owned periods
// unchanged.

const { pool } = require("../config/database");

const PERIOD_LENGTH_DAYS = 14;
const PERIODS_TO_GENERATE = 260; // ~10 years of fortnightly periods
const ANCHOR_START = new Date("2026-01-01T00:00:00Z");

const SELECT_COLUMNS = `
  id,
  to_char(start_date, 'YYYY-MM-DD') AS "startDate",
  to_char(end_date, 'YYYY-MM-DD') AS "endDate",
  is_locked AS "isLocked"
`;

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildPeriodDates(index) {
  const start = new Date(ANCHOR_START);
  start.setUTCDate(start.getUTCDate() + index * PERIOD_LENGTH_DAYS);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + PERIOD_LENGTH_DAYS - 1);

  return { startDate: formatDate(start), endDate: formatDate(end) };
}

// Makes sure a year of fortnightly pay periods exists in the database.
// Safe to call every time the server starts — start_date has a unique
// constraint, so periods that already exist are left untouched.
async function ensurePayPeriodsSeeded({ periodCount = PERIODS_TO_GENERATE } = {}) {
  if (!Number.isInteger(periodCount) || periodCount < 1) {
    throw new TypeError("periodCount must be a positive integer");
  }

  const client = await pool.connect();
  let createdCount = 0;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('pay_period_generation'))");
    for (let index = 0; index < periodCount; index += 1) {
      const { startDate, endDate } = buildPeriodDates(index);
      const result = await client.query(
        `INSERT INTO pay_period (start_date, end_date)
         SELECT $1, $2
         WHERE NOT EXISTS (
           SELECT 1 FROM pay_period WHERE start_date <= $2 AND end_date >= $1
         )
         ON CONFLICT (start_date) DO NOTHING
         RETURNING id`,
        [startDate, endDate]
      );
      createdCount += result.rowCount;
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return {
    ok: true,
    createdCount,
    message: `Pay-period generation completed (${createdCount} created, ${periodCount - createdCount} existing or overlapping)`,
  };
}

// Marks which period is "active" (covers today) so the frontend can
// default its dropdown without re-implementing this date logic itself.
async function listPayPeriods() {
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLUMNS},
       (SELECT MAX(updated_at) FROM timesheet WHERE pay_period_id = pay_period.id) AS "lastSyncedAt"
     FROM pay_period
     ORDER BY start_date, id`
  );
  const today = formatDate(new Date());
  return rows.map((period) => ({
    ...period,
    isActive: period.startDate <= today && today <= period.endDate,
  }));
}

async function getPayPeriod(payPeriodId) {
  const { rows } = await pool.query(`SELECT ${SELECT_COLUMNS} FROM pay_period WHERE id = $1`, [payPeriodId]);
  return rows[0] || null;
}

// The period whose date range contains today — what "Import Now" and the
// nightly scheduler default to when no period is explicitly selected.
async function getActivePayPeriod() {
  const today = formatDate(new Date());
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLUMNS}
     FROM pay_period
     WHERE start_date <= $1 AND end_date >= $1
     ORDER BY start_date DESC, end_date ASC, id ASC
     LIMIT 1`,
    [today]
  );
  if (rows[0]) return rows[0];

  // Today falls outside every generated period — fall back to the earliest
  // period rather than returning nothing.
  const fallback = await pool.query(`SELECT ${SELECT_COLUMNS} FROM pay_period ORDER BY start_date, id LIMIT 1`);
  return fallback.rows[0] || null;
}

module.exports = { ensurePayPeriodsSeeded, listPayPeriods, getPayPeriod, getActivePayPeriod };
