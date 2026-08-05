// Pay-period bootstrap. NOTE: this file is shared foundation (the original
// implementation was lost in the port from the old repo — this is a minimal
// reconstruction so the server can boot). It only fills an EMPTY pay_period
// table; once any period exists (e.g. from db/seeds/001_sample_data.sql) it
// does nothing.

const { pool } = require('../config/database');

async function ensurePayPeriodsSeeded() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM pay_period');
  if (rows[0].count > 0) return;

  // Two fortnights: the previous one (so there is a finished period to
  // calculate) and the one containing today.
  await pool.query(`
    INSERT INTO pay_period (start_date, end_date, status) VALUES
      (date_trunc('week', CURRENT_DATE)::date - 14, date_trunc('week', CURRENT_DATE)::date - 1, 'draft'),
      (date_trunc('week', CURRENT_DATE)::date, date_trunc('week', CURRENT_DATE)::date + 13, 'draft')
  `);
  console.log('[payPeriodService] pay_period was empty — seeded two default fortnights.');
}

module.exports = { ensurePayPeriodsSeeded };
