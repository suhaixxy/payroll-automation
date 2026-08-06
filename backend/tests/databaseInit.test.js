require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { pool } = require('../src/config/database');
const { initializeDatabase } = require('../src/db/initializeDatabase');

describe('initializeDatabase', () => {
  afterAll(async () => {
    await pool.end();
  });

  test('applies pending SQL migrations and creates the pay_period table', async () => {
    await initializeDatabase();

    const { rows } = await pool.query(
      `SELECT filename FROM schema_migrations ORDER BY filename`
    );

    // 002/003 existed only in the old repo — this repo's migration chain
    // starts at 001 and continues from 004.
    expect(rows.map((row) => row.filename)).toEqual(
      expect.arrayContaining(['001_initial_schema.sql', '004_uc003_staff_dob.sql'])
    );

    const { rows: tableRows } = await pool.query(
      `SELECT to_regclass('public.pay_period') AS pay_period_exists`
    );

    // to_regclass drops the schema prefix when 'public' is on the
    // search_path, so accept both spellings.
    expect(['pay_period', 'public.pay_period']).toContain(tableRows[0].pay_period_exists);
  });
});
