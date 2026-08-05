// UC-003 tests. Two layers, mirroring how the code is split:
// - Pure unit tests for the engines (statutory, incentive, rounding) — no
//   database at all.
// - Integration tests for the full calculation run against throwaway data
//   (own staff/periods, created in beforeAll and deleted in afterAll), the
//   same pattern as rosterSync.test.js. Other use cases' code is never
//   called — UC-002's frozen snapshot is stubbed by inserting frozen
//   timesheet rows directly.

// Must run before config files are required — that's where DATABASE_URL /
// APP_SECRET are read from process.env.
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/database');
const { initializeDatabase } = require('../src/db/initializeDatabase');
const {
  sequelize,
  syncUc003Tables,
  PayRate,
  IncentiveScheme,
  PerformanceInput,
  PayrollLine,
  User,
} = require('../src/models');
const statutoryEngine = require('../src/services/statutoryEngine');
const incentiveEngine = require('../src/services/incentiveEngine');
const payrollCalcEngine = require('../src/services/payrollCalcEngine');

// ─── Unit tests: statutory engine (tests 6, 7, 8) ────────────────────────

describe('statutoryEngine.calculateCpf', () => {
  test('applies the ordinary wage ceiling for an eligible under-55', () => {
    // $10,000 wage is capped at the $8,000 ceiling: total 37% = $2,960,
    // employee 20% = $1,600 — both land on exact dollars here.
    const cpf = statutoryEngine.calculateCpf({ wageBaseCents: 1000000, age: 40, cpfEligible: true });
    expect(cpf.totalCents).toBe(296000);
    expect(cpf.employeeCents).toBe(160000);
    expect(cpf.employerCents).toBe(136000);
  });

  test('official rounding: total to nearest dollar, employee cents dropped', () => {
    // $577.50 x 37% = $213.675 -> total rounds UP to $214.
    // Employee 20% = $115.50 -> cents dropped -> $115. Employer = $99.
    const cpf = statutoryEngine.calculateCpf({ wageBaseCents: 57750, age: 30, cpfEligible: true });
    expect(cpf.totalCents).toBe(21400);
    expect(cpf.employeeCents).toBe(11500);
    expect(cpf.employerCents).toBe(9900);
  });

  test('uses the >55–60 age band rates (2026: 16% + 18%)', () => {
    const cpf = statutoryEngine.calculateCpf({ wageBaseCents: 200000, age: 57, cpfEligible: true });
    expect(cpf.totalCents).toBe(68000); // 34% of $2,000
    expect(cpf.employeeCents).toBe(36000); // 18%
    expect(cpf.employerCents).toBe(32000); // 16%
  });

  test('uses the >60–65 age band rates (2026: 12.5% + 12.5%)', () => {
    const cpf = statutoryEngine.calculateCpf({ wageBaseCents: 200000, age: 63, cpfEligible: true });
    expect(cpf.totalCents).toBe(50000); // 25% of $2,000
    expect(cpf.employeeCents).toBe(25000);
    expect(cpf.employerCents).toBe(25000);
  });

  test('is zero for a non-eligible staff member', () => {
    const cpf = statutoryEngine.calculateCpf({ wageBaseCents: 500000, age: 30, cpfEligible: false });
    expect(cpf).toEqual({ employeeCents: 0, employerCents: 0, totalCents: 0 });
  });
});

describe('statutoryEngine.calculateSdl', () => {
  test('is exactly 0.25% inside the bounds', () => {
    expect(statutoryEngine.calculateSdl({ wageBaseCents: 200000 })).toBe(500); // $2,000 -> $5.00
  });

  test('applies the $2 minimum levy for low wages', () => {
    expect(statutoryEngine.calculateSdl({ wageBaseCents: 40000 })).toBe(200); // $400 -> $1 raw -> $2 min
  });

  test('applies the $11.25 maximum levy above the $4,500 wage cap', () => {
    expect(statutoryEngine.calculateSdl({ wageBaseCents: 500000 })).toBe(1125);
  });

  test('is zero when nothing was paid', () => {
    expect(statutoryEngine.calculateSdl({ wageBaseCents: 0 })).toBe(0);
  });
});

describe('statutoryEngine.ageInYears', () => {
  test('counts a birthday only once it has happened', () => {
    expect(statutoryEngine.ageInYears('1971-05-20', '2026-05-19')).toBe(54);
    expect(statutoryEngine.ageInYears('1971-05-20', '2026-05-20')).toBe(55);
  });
});

// ─── Unit tests: incentive engine (tests 4, 5, 11) ───────────────────────

const TEST_SCHEME_RULES = {
  requiredMetrics: ['sessions'],
  metrics: {
    sessions: { type: 'per_unit', rateCents: 1500 },
    enrolments: { type: 'per_unit', rateCents: 2500 },
    sales: { type: 'percentage', basisPoints: 200 },
    kpi: {
      type: 'tiered',
      tiers: [
        { min: 90, bonusCents: 50000 },
        { min: 80, bonusCents: 25000 },
      ],
    },
  },
};

describe('incentiveEngine.calculateIncentive', () => {
  test('combines per-unit, percentage and tiered rules correctly', () => {
    const result = incentiveEngine.calculateIncentive({
      scheme: { ruleDefinition: TEST_SCHEME_RULES },
      performanceInputs: [
        { metricType: 'sessions', metricValue: '24' }, // 24 x $15 = $360
        { metricType: 'enrolments', metricValue: '6' }, // 6 x $25 = $150
        { metricType: 'sales', metricValue: '1250000' }, // 2% of $12,500 = $250
        { metricType: 'kpi', metricValue: '92' }, // >= 90 tier -> $500
      ],
    });
    expect(result.incentiveCents).toBe(126000); // $1,260 total
    expect(result.missingMetrics).toEqual([]);
  });

  test('zero performance inputs is a valid $0 incentive, not an error', () => {
    const noRequired = { ...TEST_SCHEME_RULES, requiredMetrics: [] };
    const result = incentiveEngine.calculateIncentive({
      scheme: { ruleDefinition: noRequired },
      performanceInputs: [],
    });
    expect(result.incentiveCents).toBe(0);
    expect(result.missingMetrics).toEqual([]);
  });

  test('a missing REQUIRED metric is reported instead of underpaying', () => {
    const result = incentiveEngine.calculateIncentive({
      scheme: { ruleDefinition: TEST_SCHEME_RULES },
      performanceInputs: [{ metricType: 'enrolments', metricValue: '3' }],
    });
    expect(result.missingMetrics).toEqual(['sessions']);
    expect(result.incentiveCents).toBe(0);
  });

  test('kpi below every tier pays no bonus', () => {
    const result = incentiveEngine.calculateIncentive({
      scheme: { ruleDefinition: TEST_SCHEME_RULES },
      performanceInputs: [
        { metricType: 'sessions', metricValue: '1' },
        { metricType: 'kpi', metricValue: '50' },
      ],
    });
    expect(result.incentiveCents).toBe(1500); // sessions only
  });
});

// ─── Unit test: rounding (test 13) ───────────────────────────────────────

describe('payComponentCents rounding', () => {
  test('12.1h x $15.55 gives exactly $188.16 with no float drift', () => {
    // 12.1 * 15.55 = 188.155 -> half-up at the cent -> 18816.
    expect(payrollCalcEngine.payComponentCents(1210, 1555, 100)).toBe(18816);
  });

  test('plain multiplication stays exact', () => {
    expect(payrollCalcEngine.payComponentCents(1000, 1650, 100)).toBe(16500); // 10h x $16.50
    expect(payrollCalcEngine.payComponentCents(200, 1650, 150)).toBe(4950); // 2h OT x $16.50 x 1.5
  });
});

// ─── Integration: the full calculation run (tests 1–3, 9, 10–12, 14–17) ──

describe('calculatePayroll integration', () => {
  const TEST_EMAIL = 'uc003-tester@test.local';
  const TEST_PASSWORD = 'uc003-test-password';

  let token;
  let staffIds = {}; // ref -> uuid
  let previousPeriodId; // small total, calculated first (variance baseline)
  let currentPeriodId; // the main period under test
  let draftPeriodId; // stays draft, for the 409 case
  let testScheme;

  async function insertStaff(ref, overrides = {}) {
    const { rows } = await pool.query(
      `INSERT INTO staff (external_ref, full_name, employment_type, cpf_eligible, status, date_of_birth)
       VALUES ($1, $2, $3, $4, 'active', $5) RETURNING id`,
      [
        ref,
        overrides.fullName || `Test ${ref}`,
        overrides.employmentType || 'part_time',
        overrides.cpfEligible !== undefined ? overrides.cpfEligible : true,
        overrides.dateOfBirth || '1995-06-15',
      ]
    );
    staffIds[ref] = rows[0].id;
    return rows[0].id;
  }

  async function insertPeriod(startDate, endDate, status) {
    const { rows } = await pool.query(
      `INSERT INTO pay_period (start_date, end_date, status) VALUES ($1, $2, $3) RETURNING id`,
      [startDate, endDate, status]
    );
    return rows[0].id;
  }

  async function insertFrozenShift(payPeriodId, ref, { date, total, ot = 0, ph = 0, frozen = true }) {
    await pool.query(
      `INSERT INTO timesheet (pay_period_id, staff_id, shift_date, total_hours, ot_hours, ph_hours, is_frozen, match_status, match_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'matched', 'id')`,
      [payPeriodId, staffIds[ref], date, total, ot, ph, frozen]
    );
  }

  async function lineFor(payPeriodId, ref) {
    const { rows } = await pool.query(
      `SELECT * FROM payroll_line WHERE pay_period_id = $1 AND staff_id = $2`,
      [payPeriodId, staffIds[ref]]
    );
    return rows[0];
  }

  beforeAll(async () => {
    await initializeDatabase();
    await syncUc003Tables();

    // A login for the HTTP calls (register may 409 if a previous run died
    // before cleanup — the login afterwards is what must succeed).
    await request(app)
      .post('/api/user/register')
      .send({ name: 'UC003 Tester', email: TEST_EMAIL, password: TEST_PASSWORD });
    const login = await request(app)
      .post('/api/user/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    token = login.body.accessToken;

    await insertStaff('TEST-UC3-PT1'); // basic gross
    await insertStaff('TEST-UC3-PT2'); // overtime
    await insertStaff('TEST-UC3-PT3'); // public holiday
    await insertStaff('TEST-UC3-PT4'); // has hours but NO pay rate (flow 2a)
    await insertStaff('TEST-UC3-PT5', { cpfEligible: false }); // rounding + no CPF
    await insertStaff('TEST-UC3-FT1', { employmentType: 'full_time', dateOfBirth: '1988-03-10' });
    await insertStaff('TEST-UC3-FT2', { employmentType: 'full_time' }); // missing required input (flow 3a)

    // Far-future start dates so they can't collide with the seeded 2026
    // periods or other tests' throwaway periods.
    previousPeriodId = await insertPeriod('2027-05-01', '2027-05-14', 'validated');
    currentPeriodId = await insertPeriod('2027-05-15', '2027-05-28', 'validated');
    draftPeriodId = await insertPeriod('2027-05-29', '2027-06-11', 'draft');

    await PayRate.create({ staffId: staffIds['TEST-UC3-PT1'], hourlyRateCents: 1650, effectiveFrom: '2026-01-01' });
    await PayRate.create({ staffId: staffIds['TEST-UC3-PT2'], hourlyRateCents: 1650, effectiveFrom: '2026-01-01' });
    await PayRate.create({ staffId: staffIds['TEST-UC3-PT3'], hourlyRateCents: 1800, effectiveFrom: '2026-01-01' });
    await PayRate.create({ staffId: staffIds['TEST-UC3-PT5'], hourlyRateCents: 1555, effectiveFrom: '2026-01-01' });
    // TEST-UC3-PT4 deliberately has no rate.

    // Created last so it's the newest active scheme — the one the engine picks.
    testScheme = await IncentiveScheme.create({
      name: 'UC003 Test Scheme',
      ruleDefinition: TEST_SCHEME_RULES,
      active: true,
    });

    // Previous period: one small shift -> tiny total, the variance baseline.
    await insertFrozenShift(previousPeriodId, 'TEST-UC3-PT1', { date: '2027-05-02', total: 4 });

    // Current period: the full cast.
    await insertFrozenShift(currentPeriodId, 'TEST-UC3-PT1', { date: '2027-05-16', total: 6 });
    await insertFrozenShift(currentPeriodId, 'TEST-UC3-PT1', { date: '2027-05-17', total: 4 });
    await insertFrozenShift(currentPeriodId, 'TEST-UC3-PT2', { date: '2027-05-16', total: 10, ot: 2 });
    await insertFrozenShift(currentPeriodId, 'TEST-UC3-PT3', { date: '2027-05-18', total: 8, ph: 8 });
    await insertFrozenShift(currentPeriodId, 'TEST-UC3-PT4', { date: '2027-05-19', total: 8 });
    await insertFrozenShift(currentPeriodId, 'TEST-UC3-PT5', { date: '2027-05-20', total: 12.1 });
    // An UNFROZEN row that must be ignored — payroll runs on the frozen
    // snapshot only.
    await insertFrozenShift(currentPeriodId, 'TEST-UC3-PT1', { date: '2027-05-21', total: 5, frozen: false });

    await PerformanceInput.bulkCreate([
      { payPeriodId: currentPeriodId, staffId: staffIds['TEST-UC3-FT1'], metricType: 'sessions', metricValue: 24 },
      { payPeriodId: currentPeriodId, staffId: staffIds['TEST-UC3-FT1'], metricType: 'enrolments', metricValue: 6 },
      { payPeriodId: currentPeriodId, staffId: staffIds['TEST-UC3-FT1'], metricType: 'sales', metricValue: 1250000 },
      { payPeriodId: currentPeriodId, staffId: staffIds['TEST-UC3-FT1'], metricType: 'kpi', metricValue: 92 },
      // FT2: enrolments only — the required 'sessions' is missing.
      { payPeriodId: currentPeriodId, staffId: staffIds['TEST-UC3-FT2'], metricType: 'enrolments', metricValue: 3 },
    ]);

    // Calculate the previous period first (engine-level) so the current
    // period has a baseline to vary against.
    const previousRun = await payrollCalcEngine.calculatePayroll(previousPeriodId, 'jest');
    expect(previousRun.error).toBeUndefined();
  });

  afterAll(async () => {
    const periodIds = [previousPeriodId, currentPeriodId, draftPeriodId].filter(Boolean);
    const ids = Object.values(staffIds);
    if (periodIds.length > 0) {
      await pool.query(`DELETE FROM payroll_line WHERE pay_period_id = ANY($1::uuid[])`, [periodIds]);
      await pool.query(`DELETE FROM performance_input WHERE pay_period_id = ANY($1::uuid[])`, [periodIds]);
      await pool.query(`DELETE FROM timesheet WHERE pay_period_id = ANY($1::uuid[])`, [periodIds]);
      await pool.query(`DELETE FROM audit_log WHERE entity_id = ANY($1::uuid[])`, [periodIds]);
    }
    if (ids.length > 0) {
      await pool.query(`DELETE FROM pay_rate WHERE staff_id = ANY($1::uuid[])`, [ids]);
    }
    if (testScheme) await testScheme.destroy();
    if (periodIds.length > 0) {
      await pool.query(`DELETE FROM pay_period WHERE id = ANY($1::uuid[])`, [periodIds]);
    }
    if (ids.length > 0) {
      await pool.query(`DELETE FROM staff WHERE id = ANY($1::uuid[])`, [ids]);
    }
    await User.destroy({ where: { email: TEST_EMAIL } });
    await pool.end();
    await sequelize.close();
  });

  test('request without a valid JWT is rejected with 401', async () => {
    const noToken = await request(app)
      .post('/api/payroll/calculate')
      .send({ payPeriodId: currentPeriodId });
    expect(noToken.status).toBe(401);

    const badToken = await request(app)
      .get(`/api/payroll/${currentPeriodId}`)
      .set('Authorization', 'Bearer not-a-real-token');
    expect(badToken.status).toBe(401);
  });

  test('calculates the current period: exact gross/OT/PH/net cents per line', async () => {
    const response = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({ payPeriodId: currentPeriodId });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('pending_approval');

    // Test 1 — basic: 10h x $16.50 = $165.00, across two frozen shifts;
    // the unfrozen 5h shift is ignored. CPF (age 31): total 37% of $165 =
    // $61.05 -> $61; employee $33.00 exact. SDL: $0.41 -> $2 minimum.
    const pt1 = await lineFor(currentPeriodId, 'TEST-UC3-PT1');
    expect(pt1.gross_pay_cents).toBe(16500);
    expect(pt1.cpf_employee_cents).toBe(3300);
    expect(pt1.cpf_employer_cents).toBe(2800);
    expect(pt1.sdl_cents).toBe(200);
    expect(pt1.line_status).toBe('complete');

    // Test 2 — overtime: 8h regular + 2h OT at 1.5x = $132 + $49.50.
    const pt2 = await lineFor(currentPeriodId, 'TEST-UC3-PT2');
    expect(pt2.gross_pay_cents).toBe(18150);

    // Test 3 — public holiday: 8h entirely at 2.0x = $288.00.
    const pt3 = await lineFor(currentPeriodId, 'TEST-UC3-PT3');
    expect(pt3.gross_pay_cents).toBe(28800);

    // Test 13 (integration) + test 7: 12.1h x $15.55 = exactly $188.16,
    // and a non-CPF-eligible person pays no CPF at all.
    const pt5 = await lineFor(currentPeriodId, 'TEST-UC3-PT5');
    expect(pt5.gross_pay_cents).toBe(18816);
    expect(pt5.cpf_employee_cents).toBe(0);
    expect(pt5.cpf_employer_cents).toBe(0);

    // Test 4 — full-timer incentive: $360 + $150 + $250 + $500 = $1,260.
    const ft1 = await lineFor(currentPeriodId, 'TEST-UC3-FT1');
    expect(ft1.gross_pay_cents).toBe(0); // never from hours
    expect(ft1.incentive_cents).toBe(126000);
    expect(ft1.line_status).toBe('complete');

    // Test 9 — net = gross + incentive − CPF(employee) − SDL − other,
    // for every one of our lines.
    for (const ref of ['TEST-UC3-PT1', 'TEST-UC3-PT2', 'TEST-UC3-PT3', 'TEST-UC3-PT5', 'TEST-UC3-FT1']) {
      const line = await lineFor(currentPeriodId, ref);
      expect(line.net_pay_cents).toBe(
        line.gross_pay_cents +
          line.incentive_cents -
          line.cpf_employee_cents -
          line.sdl_cents -
          line.other_deductions_cents
      );
    }
  });

  test('missing pay rate flags the line incomplete and excludes it from totals', async () => {
    const pt4 = await lineFor(currentPeriodId, 'TEST-UC3-PT4');
    expect(pt4.line_status).toBe('incomplete');
    expect(pt4.notes).toMatch(/pay rate/i);

    const totals = await payrollCalcEngine.derivePeriodTotals(currentPeriodId);
    // Exactly the complete lines: 16500 + 18150 + 28800 + 18816 + 126000.
    expect(totals.grossCents).toBe(208266);
  });

  test('missing required performance input flags the full-timer incomplete', async () => {
    const ft2 = await lineFor(currentPeriodId, 'TEST-UC3-FT2');
    expect(ft2.line_status).toBe('incomplete');
    expect(ft2.notes).toMatch(/sessions/);
    expect(ft2.incentive_cents).toBe(0);
  });

  test('variance beyond the previous period raises the warning without blocking', async () => {
    // Previous period gross: 4h x $16.50 = $66. Current: $2,082.66 — far
    // beyond the threshold, and the run above still returned 200.
    const read = await request(app)
      .get(`/api/payroll/${currentPeriodId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(read.status).toBe(200);
    expect(read.body.varianceWarning).toBe(true);
    expect(read.body.variance.previousGrossCents).toBe(6600);
    expect(read.body.variance.currentGrossCents).toBe(208266);
  });

  test('a successful run moves the period to pending_approval', async () => {
    const { rows } = await pool.query(`SELECT status FROM pay_period WHERE id = $1`, [currentPeriodId]);
    expect(rows[0].status).toBe('pending_approval');
  });

  test('calculating a non-validated period returns 409 and writes nothing', async () => {
    const response = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({ payPeriodId: draftPeriodId });
    expect(response.status).toBe(409);

    const { rows } = await pool.query(`SELECT COUNT(*) FROM payroll_line WHERE pay_period_id = $1`, [
      draftPeriodId,
    ]);
    expect(Number(rows[0].count)).toBe(0);
  });

  test('an unknown period returns 404', async () => {
    const response = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({ payPeriodId: '00000000-0000-4000-8000-000000000000' });
    expect(response.status).toBe(404);
  });

  test('re-running after a rejection replaces lines with no duplicates', async () => {
    const before = await pool.query(
      `SELECT COUNT(*) FROM payroll_line WHERE pay_period_id = $1`,
      [currentPeriodId]
    );

    // Simulate UC-004 rejecting the period back for recalculation.
    await pool.query(`UPDATE pay_period SET status = 'validated' WHERE id = $1`, [currentPeriodId]);

    const rerun = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({ payPeriodId: currentPeriodId });
    expect(rerun.status).toBe(200);

    const after = await pool.query(
      `SELECT COUNT(*) AS total, COUNT(DISTINCT staff_id) AS distinct_staff
       FROM payroll_line WHERE pay_period_id = $1`,
      [currentPeriodId]
    );
    expect(Number(after.rows[0].total)).toBe(Number(before.rows[0].count));
    expect(Number(after.rows[0].distinct_staff)).toBe(Number(after.rows[0].total));
  });
});
