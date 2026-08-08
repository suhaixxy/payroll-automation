// Shared pay-period concept (used by UC-001 onward). Generates a rolling
// year of fortnightly pay periods and persists them in Postgres, so the
// app isn't stuck syncing against a single hardcoded period forever.

const { pool } = require("../config/database");

const PERIOD_LENGTH_DAYS = 14;
const PERIODS_TO_GENERATE = 260; // ~10 years of fortnightly periods
const ANCHOR_START = new Date("2026-01-01T00:00:00Z");

const SELECT_COLUMNS = `
  id,
  to_char(start_date, 'YYYY-MM-DD') AS "startDate",
  to_char(end_date, 'YYYY-MM-DD') AS "endDate"
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
async function ensurePayPeriodsSeeded() {
  try {
    for (let index = 0; index < PERIODS_TO_GENERATE; index += 1) {
      const { startDate, endDate } = buildPeriodDates(index);
      await pool.query(
        `INSERT INTO pay_period (start_date, end_date) VALUES ($1, $2) ON CONFLICT (start_date) DO NOTHING`,
        [startDate, endDate]
      );
    }

    return { ok: true, message: "Pay periods seeded successfully" };
  } catch (error) {
    console.warn("[payPeriodService] Unable to seed pay periods:", error.message);
    return { ok: false, message: "Database unavailable during startup; continuing in degraded mode" };
  }
}

// Marks which period is "active" (covers today) so the frontend can
// default its dropdown without re-implementing this date logic itself.
async function listPayPeriods() {
  const { rows } = await pool.query(`SELECT ${SELECT_COLUMNS} FROM pay_period ORDER BY start_date`);
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
    `SELECT ${SELECT_COLUMNS} FROM pay_period WHERE start_date <= $1 AND end_date >= $1 LIMIT 1`,
    [today]
  );
  if (rows[0]) return rows[0];

  // Today falls outside every generated period — fall back to the earliest
  // period rather than returning nothing.
  const fallback = await pool.query(`SELECT ${SELECT_COLUMNS} FROM pay_period ORDER BY start_date LIMIT 1`);
  return fallback.rows[0] || null;
}

module.exports = { ensurePayPeriodsSeeded, listPayPeriods, getPayPeriod, getActivePayPeriod };
