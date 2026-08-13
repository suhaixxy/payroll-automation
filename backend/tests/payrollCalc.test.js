// UC-003 phase 3.6 integration tests: the /api/uc003 run lifecycle through
// the HTTP API — calculate → 409 → recalculate (new run) → void (manager,
// reason required) → submit-approval (manager, 422 while incomplete) — plus
// the RBAC (401/403) and state-guard (404/409/422) paths. Throwaway data
// (own staff/periods/rate set) created in beforeAll, deleted in afterAll.
// Per-rule calculation maths is pinned in
// tests/calculationEngine.test.js.
//
// Test data lives in 2030 with its own rate set (newest effective_from wins
// for those dates), so seeded 2026 data can never interfere.

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/database');
const { initializeDatabase } = require('../src/db/initializeDatabase');
const { sequelize, PayRate } = require('../src/models');
const { createAndLogin, deleteTestUsers } = require('./helpers/authFixtures');

const ACCOUNTING_EMAIL = 'uc003-accounting@test.local';
const MANAGER_EMAIL = 'uc003-manager@test.local';
const PASSWORD = 'calc-test-password';
const TEST_RATE_SET_ID = '00000000-0000-4000-8000-000000000357';

let accountingToken;
let managerToken;
let periodId;
let emptyRateSetPeriodId; // a 2020 period no rate set covers
const staffIds = {};
let deactivatedStaffIds = [];

async function registerAndLogin(name, email, role) {
  return createAndLogin(app, { name, email, password: PASSWORD, role });
}

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
  if (deactivatedStaffIds.length > 0) {
    await pool.query(`UPDATE staff SET status = 'active' WHERE id = ANY($1::uuid[])`, [deactivatedStaffIds]);
    deactivatedStaffIds = [];
  }
  const { rows: stalePeriods } = await pool.query(
    `SELECT id FROM pay_period WHERE start_date IN ('2030-07-01', '2020-01-01')`
  );
  for (const period of stalePeriods) {
    await pool.query(`DELETE FROM payroll_lines WHERE period_id = $1`, [period.id]);
    await pool.query(`DELETE FROM calculation_runs WHERE period_id = $1`, [period.id]);
    await pool.query(`DELETE FROM performance_inputs WHERE period_id = $1`, [period.id]);
    await pool.query(`DELETE FROM timesheet WHERE pay_period_id = $1`, [period.id]);
  }
  const { rows: staleStaff } = await pool.query(
    `SELECT id FROM staff WHERE external_ref IN ('T-PTA', 'T-FTB', 'T-PTC')`
  );
  const ids = staleStaff.map((row) => row.id);
  if (ids.length > 0) {
    await pool.query(`DELETE FROM pay_rate WHERE staff_id = ANY($1::uuid[])`, [ids]);
    await pool.query(`DELETE FROM staff WHERE id = ANY($1::uuid[])`, [ids]);
  }
  for (const period of stalePeriods) {
    await pool.query(`DELETE FROM pay_period WHERE id = $1`, [period.id]);
  }
  await pool.query(`DELETE FROM cpf_rate_bands WHERE rate_set_id = $1`, [TEST_RATE_SET_ID]);
  await pool.query(`DELETE FROM statutory_rate_sets WHERE id = $1`, [TEST_RATE_SET_ID]);
  await deleteTestUsers(pool, [ACCOUNTING_EMAIL, MANAGER_EMAIL]);
}

beforeAll(async () => {
  await initializeDatabase();
  await cleanup(); // a previous run may have died before its afterAll

  accountingToken = await registerAndLogin('Calc Employee', ACCOUNTING_EMAIL, 'employee');
  managerToken = await registerAndLogin('Calc Manager', MANAGER_EMAIL, 'manager');

  const { rows: userRows } = await pool.query(`SELECT id FROM user_account WHERE email = $1`, [MANAGER_EMAIL]);
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

  // executeRun intentionally calculates every active employee. Isolate this
  // fixture from the evolving integrated demo seed and restore it in cleanup.
  const { rows: deactivated } = await pool.query(
    `UPDATE staff SET status = 'inactive'
     WHERE status = 'active' AND external_ref NOT IN ('T-PTA', 'T-FTB', 'T-PTC')
     RETURNING id`
  );
  deactivatedStaffIds = deactivated.map((row) => row.id);

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

const asEmployee = (req) => req.set('Authorization', `Bearer ${accountingToken}`);
const asManager = (req) => req.set('Authorization', `Bearer ${managerToken}`);

describe('guards: auth, roles, state (§2.2, §3.5)', () => {
  test('401 without a token', async () => {
    const response = await request(app).post(`/api/uc003/periods/${periodId}/calculate`);
    expect(response.status).toBe(401);
  });

  test('403: employee may not submit for approval or void a run', async () => {
    const submit = await asEmployee(
      request(app).post(`/api/uc003/periods/${periodId}/submit-approval`)
    );
    expect(submit.status).toBe(403);

    const voidRun = await asEmployee(
      request(app).post('/api/uc003/runs/00000000-0000-4000-8000-000000009999/void')
    ).send({ reason: 'x' });
    expect(voidRun.status).toBe(403);
  });

  test('403: employee cannot access organisation-wide UC-003 reads', async () => {
    const paths = [
      '/api/uc003/periods',
      `/api/uc003/periods/${periodId}/summary`,
      `/api/uc003/periods/${periodId}/lines`,
      `/api/uc003/periods/${periodId}/runs`,
      `/api/uc003/periods/${periodId}/variance`,
      `/api/uc003/periods/${periodId}/export.csv`,
      '/api/uc003/adjustments',
      '/api/uc003/performance-inputs',
      '/api/uc003/rate-sets',
      '/api/uc003/edit-log/recent',
    ];
    for (const path of paths) {
      const response = await asEmployee(request(app).get(path));
      expect(response.status).toBe(403);
    }
  });

  test('404 for an unknown period', async () => {
    const response = await asManager(
      request(app).post('/api/uc003/periods/00000000-0000-4000-8000-000000009999/calculate')
    );
    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  test('422 when no statutory rate set covers the period', async () => {
    const response = await asManager(
      request(app).post(`/api/uc003/periods/${emptyRateSetPeriodId}/calculate`)
    );
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('NO_RATE_SET');
  });
});

describe('run lifecycle (§3.1, §3.2, §5.9)', () => {
  test('calculate creates run #1 pinned to the rate set; period -> calculated', async () => {
    const response = await asManager(request(app).post(`/api/uc003/periods/${periodId}/calculate`));

    expect(response.status).toBe(201);
    const data = response.body.data;
    expect(data.run.runNumber).toBe(1);
    expect(data.run.rateSetVersion).toBe('test-2030');
    expect(data.status).toBe('calculated');

    // Complete: PT-A (904.50 gross / 180.00 CPF) + FT-B (360.00, exempt).
    // Incomplete (excluded): PT-C has hours but no rate.
    expect(data.linesComplete).toBe(2);
    expect(data.linesIncomplete).toBe(1);
    expect(data.totals.gross).toBe('1264.50');
    expect(data.totals.employeeDeductions).toBe('180.00'); // CPF employee ONLY
    expect(data.totals.employerCost).toBe('159.26'); // 155.00 + 2.26 + 2.00
    expect(data.totals.netPayable).toBe('1084.50'); // §5.6: SDL not deducted
  });

  test('409 calculating a period that is no longer validated', async () => {
    const response = await asManager(request(app).post(`/api/uc003/periods/${periodId}/calculate`));
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('PERIOD_NOT_VALIDATED');
  });

  test('recalculate creates run #2 and PRESERVES run #1 (§5.9)', async () => {
    const response = await asManager(
      request(app).post(`/api/uc003/periods/${periodId}/recalculate`)
    );
    expect(response.status).toBe(201);
    expect(response.body.data.run.runNumber).toBe(2);

    const history = await asManager(request(app).get(`/api/uc003/periods/${periodId}/runs`));
    expect(history.status).toBe(200);
    const runs = history.body.data.runs;
    expect(runs.map((run) => run.runNumber)).toEqual([2, 1]);
    expect(runs.every((run) => run.status === 'complete')).toBe(true);
  });

  test('lines endpoint serves the LATEST run with filters and paging (§6)', async () => {
    const all = await asManager(request(app).get(`/api/uc003/periods/${periodId}/lines?limit=50`));
    expect(all.status).toBe(200);
    expect(all.body.data.run.runNumber).toBe(2);
    expect(all.body.meta.total).toBe(3);
    expect(all.body.data.lines.map((line) => line.externalRef).sort()).toEqual(['T-FTB', 'T-PTA', 'T-PTC']);

    const incompleteOnly = await asManager(
      request(app).get(`/api/uc003/periods/${periodId}/lines?status=incomplete`)
    );
    expect(incompleteOnly.body.meta.total).toBe(1);
    expect(
      incompleteOnly.body.data.lines.every((line) => line.lineStatus === 'incomplete')
    ).toBe(true);

    const searched = await asManager(
      request(app).get(`/api/uc003/periods/${periodId}/lines?search=T-PTA`)
    );
    expect(searched.body.meta.total).toBe(1);
    expect(searched.body.data.lines[0].netPay).toBe('724.50');
  });

  test('line detail includes the calc_breakdown and run provenance (§5.7)', async () => {
    const list = await asManager(
      request(app).get(`/api/uc003/periods/${periodId}/lines?search=T-PTA`)
    );
    const lineId = list.body.data.lines[0].id;

    const detail = await asManager(request(app).get(`/api/uc003/lines/${lineId}`));
    expect(detail.status).toBe(200);
    const line = detail.body.data;
    expect(line.runNumber).toBe(2);
    expect(line.rateSetVersion).toBe('test-2030');
    expect(line.calcBreakdown.map((step) => step.label)).toEqual(
      expect.arrayContaining(['Regular hours', 'Overtime', 'Public holiday', 'Gross total', 'Net payable'])
    );
  });

  test('void requires a reason (400) and demotes the run (§3.3)', async () => {
    const history = await asManager(request(app).get(`/api/uc003/periods/${periodId}/runs`));
    const runTwo = history.body.data.runs.find((run) => run.runNumber === 2);

    const noReason = await asManager(request(app).post(`/api/uc003/runs/${runTwo.id}/void`)).send({});
    expect(noReason.status).toBe(400);

    const voided = await asManager(request(app).post(`/api/uc003/runs/${runTwo.id}/void`)).send({
      reason: 'Wrong rate applied — integration test',
    });
    expect(voided.status).toBe(200);

    const again = await asManager(request(app).post(`/api/uc003/runs/${runTwo.id}/void`)).send({
      reason: 'twice',
    });
    expect(again.status).toBe(409);

    // Run #1 becomes authoritative again.
    const summary = await asManager(request(app).get(`/api/uc003/periods/${periodId}/summary`));
    expect(summary.body.data.run.runNumber).toBe(1);
  });
});

describe('register export and per-staff variance (§7.2, §7.9)', () => {
  test('export.csv streams the authoritative run as a CSV download', async () => {
    const anonymous = await request(app).get(`/api/uc003/periods/${periodId}/export.csv`);
    expect(anonymous.status).toBe(401);

    const response = await asManager(
      request(app).get(`/api/uc003/periods/${periodId}/export.csv`)
    );
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/csv/);
    expect(response.headers['content-disposition']).toMatch(/payroll-register_2030-07-01_to_2030-07-14_run1\.csv/);

    const csvLines = response.text.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(csvLines[0]).toBe(
      'staff_ref,staff_name,employment_type,cpf_eligible,regular_hours,ot_hours,ph_hours,' +
        'hourly_rate_used,gross_from_hours,incentive_amount,adjustments_total,gross_total,' +
        'cpf_employee,cpf_employer,sdl_employer,net_payable,line_status,incomplete_reasons'
    );
    expect(csvLines).toHaveLength(1 + 3); // header + this fixture's active staff
    expect(csvLines.slice(1).map((row) => row.split(',')[0]).sort()).toEqual(['T-FTB', 'T-PTA', 'T-PTC']);
    const ptaRow = csvLines.find((row) => row.startsWith('T-PTA,'));
    expect(ptaRow).toContain('904.50'); // gross from hours
    expect(ptaRow).toContain('724.50'); // net payable
    const ptcRow = csvLines.find((row) => row.startsWith('T-PTC,'));
    expect(ptcRow).toContain('MISSING_PAY_RATE');
  });

  test('variance endpoint returns per-staff rows for the authoritative run', async () => {
    const response = await asManager(
      request(app).get(`/api/uc003/periods/${periodId}/variance`)
    );
    expect(response.status).toBe(200);
    const data = response.body.data;
    expect(data.currentRun.runNumber).toBe(1); // run 2 was voided above
    // Variance deliberately includes employees found only in the previous
    // authoritative run. Assert this fixture's current population, not the
    // evolving shared seed's previous-run population.
    const currentRows = data.rows.filter((row) => row.currentLineStatus !== null);
    expect(currentRows.map((row) => row.externalRef).sort()).toEqual(['T-FTB', 'T-PTA', 'T-PTC']);

    const pta = data.rows.find((row) => row.externalRef === 'T-PTA');
    expect(pta.currentNet).toBe('724.50');
    // Incomplete lines carry no usable net — surfaced as null, never $0.00.
    const ptc = data.rows.find((row) => row.externalRef === 'T-PTC');
    expect(ptc.currentNet).toBeNull();
    expect(ptc.currentLineStatus).toBe('incomplete');
  });
});

describe('submit to approval (§5.1, §6)', () => {
  test('422 while any line of the authoritative run is incomplete', async () => {
    const response = await asManager(
      request(app).post(`/api/uc003/periods/${periodId}/submit-approval`)
    );
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INCOMPLETE_LINES');
  });

  test('succeeds once every line is complete; period -> pending_approval', async () => {
    // Force-complete the authoritative run's lines — resolving them for real
    // is the phase 5 resolve-loop flow; here we test the endpoint guard.
    const summary = await asManager(request(app).get(`/api/uc003/periods/${periodId}/summary`));
    const runId = summary.body.data.run.id;
    await pool.query(
      `UPDATE payroll_lines SET line_status = 'complete', incomplete_reasons = NULL WHERE run_id = $1`,
      [runId]
    );

    const response = await asManager(
      request(app).post(`/api/uc003/periods/${periodId}/submit-approval`)
    );
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('pending_approval');
  });

  test('recalculating a pending_approval period is allowed and moves it back', async () => {
    const response = await asManager(
      request(app).post(`/api/uc003/periods/${periodId}/recalculate`)
    );
    expect(response.status).toBe(201);
    expect(response.body.data.run.runNumber).toBe(3);
    expect(response.body.data.status).toBe('calculated');
  });

  test('409 once the period is approved: no recalculation, no voiding (§5.9)', async () => {
    // UC-004 owns the approved transition — simulated directly in SQL.
    await pool.query(`UPDATE pay_period SET status = 'approved' WHERE id = $1`, [periodId]);

    const recalc = await asManager(
      request(app).post(`/api/uc003/periods/${periodId}/recalculate`)
    );
    expect(recalc.status).toBe(409);
    expect(recalc.body.error.code).toBe('PERIOD_LOCKED');

    const history = await asManager(request(app).get(`/api/uc003/periods/${periodId}/runs`));
    const runThree = history.body.data.runs.find((run) => run.runNumber === 3);
    const voided = await asManager(request(app).post(`/api/uc003/runs/${runThree.id}/void`)).send({
      reason: 'should be refused',
    });
    expect(voided.status).toBe(409);
    expect(voided.body.error.code).toBe('PERIOD_LOCKED');
  });
});
