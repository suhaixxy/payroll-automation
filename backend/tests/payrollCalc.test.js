// UC-003 integration tests: the full calculation run through the HTTP API
// against throwaway data (own staff/period/rate set, created in beforeAll
// and deleted in afterAll). UC-002's frozen snapshot is stubbed by inserting
// frozen timesheet rows directly. The per-rule unit tests live in
// src/services/__tests__/calculationEngine.test.js — this file covers the
// wiring: endpoint guards (401/404/409/422), persistence, derived totals,
// and the §5.6 employer-borne SDL split at the period level.
//
// (Rewritten in phase 2: the previous version asserted the old engine's
// behaviour — SDL deducted from net pay, scheme-based incentives — which
// the guide explicitly corrects.)
//
// Test data lives in 2030 with its own rate set (newest effective_from wins
// for those dates), so seeded 2026 data can never interfere.

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/database');
const { initializeDatabase } = require('../src/db/initializeDatabase');
const { sequelize, syncUc003Tables, PayRate, User } = require('../src/models');

const TEST_EMAIL = 'uc003-calc-tester@test.local';
const TEST_PASSWORD = 'calc-test-password';
const TEST_RATE_SET_ID = '00000000-0000-4000-8000-000000000357';

let token;
let periodId;
let emptyRateSetPeriodId; // a 2020 period no rate set covers
const staffIds = {}; // key -> uuid

async function createStaff(externalRef, fullName, employmentType, cpfEligible, dateOfBirth) {
  const { rows } = await pool.query(
    `INSERT INTO staff (external_ref, full_name, employment_type, cpf_eligible, status)
     VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
    [externalRef, fullName, employmentType, cpfEligible]
  );
  if (dateOfBirth) {
    await pool.query(`UPDATE staff SET date_of_birth = $2 WHERE id = $1`, [rows[0].id, dateOfBirth]);
  }
  return rows[0].id;
}

async function cleanup() {
  const { rows: staleStaff } = await pool.query(
    `SELECT id FROM staff WHERE external_ref IN ('T-PTA', 'T-FTB', 'T-PTC')`
  );
  const ids = staleStaff.map((row) => row.id);
  const { rows: stalePeriods } = await pool.query(
    `SELECT id FROM pay_period WHERE start_date IN ('2030-07-01', '2020-01-01')`
  );
  for (const period of stalePeriods) {
    await pool.query(`DELETE FROM payroll_line WHERE pay_period_id = $1`, [period.id]);
    await pool.query(`DELETE FROM performance_inputs WHERE period_id = $1`, [period.id]);
    await pool.query(`DELETE FROM timesheet WHERE pay_period_id = $1`, [period.id]);
  }
  if (ids.length > 0) {
    await pool.query(`DELETE FROM pay_rate WHERE staff_id = ANY($1::uuid[])`, [ids]);
    await pool.query(`DELETE FROM staff WHERE id = ANY($1::uuid[])`, [ids]);
  }
  for (const period of stalePeriods) {
    await pool.query(`DELETE FROM pay_period WHERE id = $1`, [period.id]);
  }
  await pool.query(`DELETE FROM cpf_rate_bands WHERE rate_set_id = $1`, [TEST_RATE_SET_ID]);
  await pool.query(`DELETE FROM statutory_rate_sets WHERE id = $1`, [TEST_RATE_SET_ID]);
  await User.destroy({ where: { email: TEST_EMAIL } });
}

beforeAll(async () => {
  await initializeDatabase();
  await syncUc003Tables();
  await cleanup(); // a previous run may have died before its afterAll

  // Login identity (accounting is allowed to calculate).
  await request(app)
    .post('/api/user/register')
    .send({ name: 'Calc Tester', email: TEST_EMAIL, password: TEST_PASSWORD, role: 'accounting' });
  const login = await request(app)
    .post('/api/user/login')
    .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  token = login.body.accessToken;

  // Rate set effective for the 2030 test window (same figures as the seed).
  const { rows: userRows } = await pool.query(`SELECT id FROM users WHERE email = $1`, [TEST_EMAIL]);
  await pool.query(
    `INSERT INTO statutory_rate_sets
       (id, version_label, effective_from, effective_to, sdl_rate, sdl_min, sdl_max,
        sdl_wage_cap, ot_multiplier, ph_multiplier, cpf_ow_ceiling, created_by)
     VALUES ($1, 'test-2030', '2030-01-01', NULL, 0.0025, 2.00, 11.25,
             4500.00, 1.5000, 2.0000, 8000.00, $2)`,
    [TEST_RATE_SET_ID, userRows[0].id]
  );
  await pool.query(
    `INSERT INTO cpf_rate_bands (rate_set_id, age_min, age_max, employee_rate, employer_rate, min_wage_threshold)
     VALUES ($1, 0, 55, 0.2000, 0.1700, 500.00),
            ($1, 56, 60, 0.1800, 0.1600, 500.00),
            ($1, 61, NULL, 0.1250, 0.1250, 500.00)`,
    [TEST_RATE_SET_ID]
  );

  // A validated period with a frozen snapshot.
  const { rows: periodRows } = await pool.query(
    `INSERT INTO pay_period (start_date, end_date, status, validated_at)
     VALUES ('2030-07-01', '2030-07-14', 'validated', now()) RETURNING id`
  );
  periodId = periodRows[0].id;

  // PT-A: part-timer, age 40 in 2030, $18/h, 32h regular + 1.5h OT + 8h PH.
  staffIds.PTA = await createStaff('T-PTA', 'Test Part Timer A', 'part_time', true, '1990-02-20');
  await PayRate.create({ staffId: staffIds.PTA, hourlyRateCents: 1800, effectiveFrom: '2030-01-01' });
  await pool.query(
    `INSERT INTO timesheet (pay_period_id, staff_id, total_hours, ot_hours, ph_hours, is_frozen, match_status)
     VALUES ($1, $2, 33.5, 1.5, 0, true, 'matched'),
            ($1, $2, 8, 0, 8, true, 'matched')`,
    [periodId, staffIds.PTA]
  );

  // FT-B: CPF-exempt full-timer, incentives only (24 sessions × $15).
  staffIds.FTB = await createStaff('T-FTB', 'Test Full Timer B', 'full_time', false, null);
  await pool.query(
    `INSERT INTO performance_inputs (staff_id, period_id, input_type, quantity, unit_value, created_by)
     VALUES ($1, $2, 'sessions', 24.00, 15.00, $3)`,
    [staffIds.FTB, periodId, userRows[0].id]
  );

  // PT-C: part-timer with hours but NO pay rate -> incomplete line.
  staffIds.PTC = await createStaff('T-PTC', 'Test Part Timer C', 'part_time', true, '1999-01-25');
  await pool.query(
    `INSERT INTO timesheet (pay_period_id, staff_id, total_hours, ot_hours, ph_hours, is_frozen, match_status)
     VALUES ($1, $2, 16, 0, 0, true, 'matched')`,
    [periodId, staffIds.PTC]
  );

  // A validated period in 2020 — no rate set covers it (422 case).
  const { rows: oldRows } = await pool.query(
    `INSERT INTO pay_period (start_date, end_date, status, validated_at)
     VALUES ('2020-01-01', '2020-01-14', 'validated', now()) RETURNING id`
  );
  emptyRateSetPeriodId = oldRows[0].id;
});

afterAll(async () => {
  await cleanup();
  await sequelize.close();
  await pool.end();
});

describe('POST /api/payroll/calculate', () => {
  test('401 without a token', async () => {
    const response = await request(app).post('/api/payroll/calculate').send({ payPeriodId: periodId });
    expect(response.status).toBe(401);
  });

  test('404 for an unknown period', async () => {
    const response = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({ payPeriodId: '00000000-0000-4000-8000-000000009999' });
    expect(response.status).toBe(404);
  });

  test('422 when no statutory rate set covers the period', async () => {
    const response = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({ payPeriodId: emptyRateSetPeriodId });
    expect(response.status).toBe(422);
    expect(response.body.error).toBe('NO_RATE_SET');
  });

  test('happy path: rate-set-pinned run with employer-borne SDL totals', async () => {
    const response = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({ payPeriodId: periodId });

    expect(response.status).toBe(200);
    const data = response.body;

    expect(data.status).toBe('pending_approval');
    expect(data.rateSet.versionLabel).toBe('test-2030');
    // The engine lines up EVERY active staff member: our 3 test staff plus
    // the 3 seeded ones (who have no data in this test period and therefore
    // come out incomplete and excluded from totals).
    expect(data.lineCount).toBe(6);
    expect(data.incompleteCount).toBe(4); // PT-C (no pay rate) + 3 seeded staff

    // Hand-computed (per-step maths is pinned in the unit suite):
    // PT-A: gross 904.50 (576 + 40.50 + 288); CPF employee floor(180.90) =
    //   180.00; total round(334.665) = 335.00 -> employer 155.00; SDL 2.26;
    //   net 724.50.
    // FT-B: 360.00 incentive, CPF exempt 0/0, SDL min 2.00, net 360.00.
    // PT-C: incomplete -> excluded from every total.
    expect(data.totals.grossCents).toBe(90450 + 36000);
    expect(data.totals.deductionsCents).toBe(18000); // CPF employee ONLY
    expect(data.totals.employerCostCents).toBe(15500 + 226 + 200);
    expect(data.totals.netCents).toBe(72450 + 36000);
    // §5.6: net = gross − employee deductions; SDL never enters that chain.
    expect(data.totals.netCents).toBe(data.totals.grossCents - data.totals.deductionsCents);
  });

  test('409 when the period is no longer validated (already calculated)', async () => {
    const response = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({ payPeriodId: periodId });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe('PAY_PERIOD_NOT_VALIDATED');
  });
});

describe('GET /api/payroll/:payPeriodId', () => {
  test('returns lines with breakdown, reason codes and the CPF-exempt flag', async () => {
    const response = await request(app)
      .get(`/api/payroll/${periodId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const lines = response.body.lines;
    expect(lines.length).toBeGreaterThanOrEqual(3); // ours + every other active staff

    const pta = lines.find((line) => line.externalRef === 'T-PTA');
    expect(pta.lineStatus).toBe('complete');
    expect(pta.netPayCents).toBe(72450);
    expect(pta.sdlCents).toBe(226);
    const breakdownLabels = pta.calcBreakdown.map((step) => step.label);
    expect(breakdownLabels).toEqual(
      expect.arrayContaining(['Regular hours', 'Overtime', 'Public holiday', 'Gross total', 'Net payable'])
    );

    const ftb = lines.find((line) => line.externalRef === 'T-FTB');
    expect(ftb.cpfEligible).toBe(false);
    expect(ftb.cpfEmployeeCents).toBe(0);
    expect(ftb.lineStatus).toBe('complete');

    const ptc = lines.find((line) => line.externalRef === 'T-PTC');
    expect(ptc.lineStatus).toBe('incomplete');
    expect(ptc.incompleteReasons.map((reason) => reason.code)).toEqual(['MISSING_PAY_RATE']);
  });

  test('404 for a made-up period id', async () => {
    const response = await request(app)
      .get('/api/payroll/00000000-0000-4000-8000-000000009999')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
  });
});
