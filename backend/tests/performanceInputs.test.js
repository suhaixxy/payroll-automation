// UC-003 phase 5.4: performance inputs CRUD + the §5.8 resolve loop — a
// full-timer's line goes calculate → incomplete (MISSING_PERFORMANCE_INPUT)
// → input saved → recalculate → complete. Also: RBAC (401/403), validation
// (400), the one-live-row-per-metric rule (409 + re-create after soft
// delete), the period lock (409), and audit rows. Own fixture in 2032.

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/database');
const { initializeDatabase } = require('../src/db/initializeDatabase');
const { sequelize, syncUc003Tables, User } = require('../src/models');

const ACCOUNTING_EMAIL = 'uc003-pi-accounting@test.local';
const MANAGER_EMAIL = 'uc003-pi-manager@test.local';
const PASSWORD = 'input-test-password';
const TEST_RATE_SET_ID = '00000000-0000-4000-8000-000000000559';

let accountingToken;
let managerToken;
let periodId;
let staffId;
let inputId;

async function registerAndLogin(name, email, role) {
  await request(app).post('/api/user/register').send({ name, email, password: PASSWORD, role });
  const login = await request(app).post('/api/user/login').send({ email, password: PASSWORD });
  return login.body.accessToken;
}

async function cleanup() {
  const { rows: stalePeriods } = await pool.query(
    `SELECT id FROM pay_period WHERE start_date = '2032-07-01'`
  );
  for (const period of stalePeriods) {
    await pool.query(`DELETE FROM payroll_lines WHERE period_id = $1`, [period.id]);
    await pool.query(`DELETE FROM calculation_runs WHERE period_id = $1`, [period.id]);
    await pool.query(`DELETE FROM performance_inputs WHERE period_id = $1`, [period.id]);
    await pool.query(`DELETE FROM timesheet WHERE pay_period_id = $1`, [period.id]);
  }
  const { rows: staleStaff } = await pool.query(`SELECT id FROM staff WHERE external_ref = 'T-PI1'`);
  const ids = staleStaff.map((row) => row.id);
  if (ids.length > 0) {
    await pool.query(`DELETE FROM staff WHERE id = ANY($1::uuid[])`, [ids]);
  }
  for (const period of stalePeriods) {
    await pool.query(`DELETE FROM pay_period WHERE id = $1`, [period.id]);
  }
  await pool.query(`DELETE FROM cpf_rate_bands WHERE rate_set_id = $1`, [TEST_RATE_SET_ID]);
  await pool.query(`DELETE FROM statutory_rate_sets WHERE id = $1`, [TEST_RATE_SET_ID]);
  await pool.query(
    `DELETE FROM uc003_audit_log WHERE actor_id IN (SELECT id FROM users WHERE email = ANY($1))`,
    [[ACCOUNTING_EMAIL, MANAGER_EMAIL]]
  );
  await User.destroy({ where: { email: [ACCOUNTING_EMAIL, MANAGER_EMAIL] } });
}

beforeAll(async () => {
  await initializeDatabase();
  await syncUc003Tables();
  await cleanup();

  accountingToken = await registerAndLogin('PI Accounting', ACCOUNTING_EMAIL, 'accounting');
  managerToken = await registerAndLogin('PI Manager', MANAGER_EMAIL, 'manager');

  const { rows: userRows } = await pool.query(`SELECT id FROM users WHERE email = $1`, [MANAGER_EMAIL]);
  await pool.query(
    `INSERT INTO statutory_rate_sets
       (id, version_label, effective_from, effective_to, sdl_rate, sdl_min, sdl_max,
        sdl_wage_cap, ot_multiplier, ph_multiplier, cpf_ow_ceiling, created_by)
     VALUES ($1, 'test-2032', '2032-01-01', NULL, 0.0025, 2.00, 11.25,
             4500.00, 1.5000, 2.0000, 8000.00, $2)`,
    [TEST_RATE_SET_ID, userRows[0].id]
  );
  await pool.query(
    `INSERT INTO cpf_rate_bands (rate_set_id, age_min, age_max, employee_rate, employer_rate, min_wage_threshold)
     VALUES ($1, 0, 55, 0.2000, 0.1700, 500.00),
            ($1, 56, NULL, 0.1800, 0.1600, 500.00)`,
    [TEST_RATE_SET_ID]
  );

  const { rows: periodRows } = await pool.query(
    `INSERT INTO pay_period (start_date, end_date, status, validated_at)
     VALUES ('2032-07-01', '2032-07-14', 'validated', now()) RETURNING id`
  );
  periodId = periodRows[0].id;

  // A full-timer with NO performance input — the §5.8 incomplete case.
  const { rows: staffRows } = await pool.query(
    `INSERT INTO staff (external_ref, full_name, employment_type, cpf_eligible, status)
     VALUES ('T-PI1', 'Test Incentive Earner', 'full_time', true, 'active') RETURNING id`
  );
  staffId = staffRows[0].id;
  await pool.query(`UPDATE staff SET date_of_birth = '1992-03-01' WHERE id = $1`, [staffId]);
});

afterAll(async () => {
  await cleanup();
  await sequelize.close();
  await pool.end();
});

const asAccounting = (req) => req.set('Authorization', `Bearer ${accountingToken}`);
const asManager = (req) => req.set('Authorization', `Bearer ${managerToken}`);

async function fetchLine() {
  const lines = await asAccounting(
    request(app).get(`/api/uc003/periods/${periodId}/lines?search=T-PI1`)
  );
  return lines.body.data.lines[0];
}

describe('RBAC and validation (§2.2, §2.6)', () => {
  test('401 without a token; 403 for accounting mutations', async () => {
    const anonymous = await request(app).get('/api/uc003/performance-inputs');
    expect(anonymous.status).toBe(401);

    const create = await asAccounting(request(app).post('/api/uc003/performance-inputs')).send({
      staffId,
      periodId,
      inputType: 'sessions',
      quantity: 1,
      unitValue: 1,
    });
    expect(create.status).toBe(403);
  });

  test('400: negative quantity, 3-decimal unit value, bad input type', async () => {
    const negative = await asManager(request(app).post('/api/uc003/performance-inputs')).send({
      staffId,
      periodId,
      inputType: 'sessions',
      quantity: -1,
      unitValue: 10,
    });
    expect(negative.status).toBe(400);

    const threeDp = await asManager(request(app).post('/api/uc003/performance-inputs')).send({
      staffId,
      periodId,
      inputType: 'sessions',
      quantity: 1,
      unitValue: 9.999,
    });
    expect(threeDp.status).toBe(400);

    const badType = await asManager(request(app).post('/api/uc003/performance-inputs')).send({
      staffId,
      periodId,
      inputType: '!!bad type!!',
      quantity: 1,
      unitValue: 10,
    });
    expect(badType.status).toBe(400);
  });
});

describe('resolve loop (§5.8) — the phase 5 gate', () => {
  test('calculate first: the full-timer line is incomplete, MISSING_PERFORMANCE_INPUT', async () => {
    const run = await asAccounting(request(app).post(`/api/uc003/periods/${periodId}/calculate`));
    expect(run.status).toBe(201);

    const line = await fetchLine();
    expect(line.lineStatus).toBe('incomplete');
    expect(line.incompleteReasons.map((reason) => reason.code)).toEqual([
      'MISSING_PERFORMANCE_INPUT',
    ]);
  });

  test('save the missing input, recalculate, and the line turns COMPLETE', async () => {
    const created = await asManager(request(app).post('/api/uc003/performance-inputs')).send({
      staffId,
      periodId,
      inputType: 'sessions',
      quantity: 20,
      unitValue: 15,
      notes: 'Resolved via the phase 5 loop',
    });
    expect(created.status).toBe(201);
    inputId = created.body.data.id;

    const recalc = await asAccounting(request(app).post(`/api/uc003/periods/${periodId}/recalculate`));
    expect(recalc.status).toBe(201);

    const line = await fetchLine();
    expect(line.lineStatus).toBe('complete');
    expect(line.incompleteReasons).toBeNull();
    expect(line.incentiveAmount).toBe('300.00'); // 20 × $15
    // $300 is under the $500 min-wage threshold: no employee CPF, net = gross.
    expect(line.cpfEmployee).toBe('0.00');
    expect(line.netPay).toBe('300.00');
  });
});

describe('CRUD lifecycle (§5.1 checkpoint rules)', () => {
  test('duplicate live input for the same staff+period+type is a 409', async () => {
    const duplicate = await asManager(request(app).post('/api/uc003/performance-inputs')).send({
      staffId,
      periodId,
      inputType: 'sessions',
      quantity: 5,
      unitValue: 10,
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('DUPLICATE_INPUT');
  });

  test('PATCH updates only supplied fields', async () => {
    const response = await asManager(
      request(app).patch(`/api/uc003/performance-inputs/${inputId}`)
    ).send({ quantity: 24 });
    expect(response.status).toBe(200);
    expect(response.body.data.quantity).toBe('24.00');
    expect(response.body.data.unitValue).toBe('15.00'); // untouched
    expect(response.body.data.notes).toBe('Resolved via the phase 5 loop'); // untouched
  });

  test('soft delete frees the metric slot: re-creating the same type works', async () => {
    const removed = await asManager(request(app).delete(`/api/uc003/performance-inputs/${inputId}`));
    expect(removed.status).toBe(204);

    const list = await asAccounting(
      request(app).get(`/api/uc003/performance-inputs?periodId=${periodId}`)
    );
    expect(list.body.data.performanceInputs).toHaveLength(0);

    // The 013 partial index only guards LIVE rows — this must succeed.
    const recreated = await asManager(request(app).post('/api/uc003/performance-inputs')).send({
      staffId,
      periodId,
      inputType: 'sessions',
      quantity: 18,
      unitValue: 15,
    });
    expect(recreated.status).toBe(201);
    inputId = recreated.body.data.id;
  });

  test('every mutation wrote an audit row (§2.3)', async () => {
    const { rows } = await pool.query(
      `SELECT action, COUNT(*)::int AS count
       FROM uc003_audit_log
       WHERE entity = 'performance_input'
       GROUP BY action`
    );
    const byAction = Object.fromEntries(rows.map((row) => [row.action, row.count]));
    expect(byAction.create).toBeGreaterThanOrEqual(2);
    expect(byAction.update).toBeGreaterThanOrEqual(1);
    expect(byAction.delete).toBeGreaterThanOrEqual(1);
  });

  test('409 on every mutation once the period is approved (§4.5 pattern)', async () => {
    await pool.query(`UPDATE pay_period SET status = 'approved' WHERE id = $1`, [periodId]);

    const create = await asManager(request(app).post('/api/uc003/performance-inputs')).send({
      staffId,
      periodId,
      inputType: 'courses',
      quantity: 1,
      unitValue: 50,
    });
    expect(create.status).toBe(409);

    const patch = await asManager(
      request(app).patch(`/api/uc003/performance-inputs/${inputId}`)
    ).send({ quantity: 1 });
    expect(patch.status).toBe(409);

    const remove = await asManager(request(app).delete(`/api/uc003/performance-inputs/${inputId}`));
    expect(remove.status).toBe(409);
  });
});
