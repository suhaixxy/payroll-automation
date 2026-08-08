// UC-003 phase 4.9: payroll adjustments CRUD through the HTTP API — RBAC
// (401/403), validation (400), soft delete (204 + disappearance), the
// approved/paid period lock (409), audit rows, and the §5.4 engine fold-in
// (adjustments enter gross; only cpf_applicable ones enter the CPF wage
// base). Own fixture in 2031 so nothing collides with other suites.

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/database');
const { initializeDatabase } = require('../src/db/initializeDatabase');
const { sequelize, syncUc003Tables, PayRate, User } = require('../src/models');

const ACCOUNTING_EMAIL = 'uc003-adj-accounting@test.local';
const MANAGER_EMAIL = 'uc003-adj-manager@test.local';
const PASSWORD = 'adjust-test-password';
const TEST_RATE_SET_ID = '00000000-0000-4000-8000-000000000458';

let accountingToken;
let managerToken;
let periodId;
let staffId;
let bonusId;
let deductionId;

async function registerAndLogin(name, email, role) {
  await request(app).post('/api/user/register').send({ name, email, password: PASSWORD, role });
  const login = await request(app).post('/api/user/login').send({ email, password: PASSWORD });
  return login.body.accessToken;
}

async function cleanup() {
  const { rows: stalePeriods } = await pool.query(
    `SELECT id FROM pay_period WHERE start_date = '2031-07-01'`
  );
  for (const period of stalePeriods) {
    await pool.query(`DELETE FROM payroll_lines WHERE period_id = $1`, [period.id]);
    await pool.query(`DELETE FROM calculation_runs WHERE period_id = $1`, [period.id]);
    await pool.query(`DELETE FROM payroll_adjustments WHERE period_id = $1`, [period.id]);
    await pool.query(`DELETE FROM timesheet WHERE pay_period_id = $1`, [period.id]);
  }
  const { rows: staleStaff } = await pool.query(
    `SELECT id FROM staff WHERE external_ref = 'T-ADJ1'`
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

  accountingToken = await registerAndLogin('Adj Accounting', ACCOUNTING_EMAIL, 'accounting');
  managerToken = await registerAndLogin('Adj Manager', MANAGER_EMAIL, 'manager');

  const { rows: userRows } = await pool.query(`SELECT id FROM users WHERE email = $1`, [MANAGER_EMAIL]);
  await pool.query(
    `INSERT INTO statutory_rate_sets
       (id, version_label, effective_from, effective_to, sdl_rate, sdl_min, sdl_max,
        sdl_wage_cap, ot_multiplier, ph_multiplier, cpf_ow_ceiling, created_by)
     VALUES ($1, 'test-2031', '2031-01-01', NULL, 0.0025, 2.00, 11.25,
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
     VALUES ('2031-07-01', '2031-07-14', 'validated', now()) RETURNING id`
  );
  periodId = periodRows[0].id;

  // One part-timer, age 40 in 2031, $18/h × 34h = $612 gross from hours.
  const { rows: staffRows } = await pool.query(
    `INSERT INTO staff (external_ref, full_name, employment_type, cpf_eligible, status)
     VALUES ('T-ADJ1', 'Test Adjustee', 'part_time', true, 'active') RETURNING id`
  );
  staffId = staffRows[0].id;
  await pool.query(`UPDATE staff SET date_of_birth = '1991-02-20' WHERE id = $1`, [staffId]);
  await PayRate.create({ staffId, hourlyRateCents: 1800, effectiveFrom: '2031-01-01' });
  await pool.query(
    `INSERT INTO timesheet (pay_period_id, staff_id, total_hours, ot_hours, ph_hours, is_frozen, match_status)
     VALUES ($1, $2, 34, 0, 0, true, 'matched')`,
    [periodId, staffId]
  );
});

afterAll(async () => {
  await cleanup();
  await sequelize.close();
  await pool.end();
});

const asAccounting = (req) => req.set('Authorization', `Bearer ${accountingToken}`);
const asManager = (req) => req.set('Authorization', `Bearer ${managerToken}`);

describe('RBAC and validation (§2.2, §2.6)', () => {
  test('401 without a token', async () => {
    const response = await request(app).get('/api/uc003/adjustments');
    expect(response.status).toBe(401);
  });

  test('403: accounting may read but never mutate', async () => {
    const create = await asAccounting(request(app).post('/api/uc003/adjustments')).send({
      staffId,
      periodId,
      adjustmentType: 'bonus',
      amount: 100,
      reason: 'should be rejected',
    });
    expect(create.status).toBe(403);

    const read = await asAccounting(request(app).get(`/api/uc003/adjustments?periodId=${periodId}`));
    expect(read.status).toBe(200);
  });

  test('400: bad type, >2dp amount, missing reason, unknown staff', async () => {
    const badType = await asManager(request(app).post('/api/uc003/adjustments')).send({
      staffId,
      periodId,
      adjustmentType: 'gift',
      amount: 100,
      reason: 'invalid type',
    });
    expect(badType.status).toBe(400);

    const badAmount = await asManager(request(app).post('/api/uc003/adjustments')).send({
      staffId,
      periodId,
      adjustmentType: 'bonus',
      amount: 10.999,
      reason: 'three decimals',
    });
    expect(badAmount.status).toBe(400);

    const noReason = await asManager(request(app).post('/api/uc003/adjustments')).send({
      staffId,
      periodId,
      adjustmentType: 'bonus',
      amount: 100,
    });
    expect(noReason.status).toBe(400);

    const unknownStaff = await asManager(request(app).post('/api/uc003/adjustments')).send({
      staffId: '00000000-0000-4000-8000-000000009999',
      periodId,
      adjustmentType: 'bonus',
      amount: 100,
      reason: 'unknown staff member',
    });
    expect(unknownStaff.status).toBe(400);
    expect(unknownStaff.body.error.details[0].field).toBe('staffId');
  });
});

describe('CRUD lifecycle (§4.1–4.6)', () => {
  test('manager creates a CPF-applicable bonus and a non-CPF deduction', async () => {
    const bonus = await asManager(request(app).post('/api/uc003/adjustments')).send({
      staffId,
      periodId,
      adjustmentType: 'bonus',
      amount: 200,
      cpfApplicable: true,
      reason: 'Retention bonus for July',
    });
    expect(bonus.status).toBe(201);
    expect(bonus.body.data.amount).toBe('200.00');
    bonusId = bonus.body.data.id;

    const deduction = await asManager(request(app).post('/api/uc003/adjustments')).send({
      staffId,
      periodId,
      adjustmentType: 'deduction',
      amount: -50,
      cpfApplicable: false,
      reason: 'Uniform cost recovery',
    });
    expect(deduction.status).toBe(201);
    expect(deduction.body.data.amount).toBe('-50.00');
    deductionId = deduction.body.data.id;
  });

  test('list filters by periodId and staffId; detail returns the row', async () => {
    const list = await asAccounting(request(app).get(`/api/uc003/adjustments?periodId=${periodId}`));
    expect(list.body.data.adjustments).toHaveLength(2);

    const byStaff = await asAccounting(
      request(app).get(`/api/uc003/adjustments?staffId=${staffId}&periodId=${periodId}`)
    );
    expect(byStaff.body.data.adjustments).toHaveLength(2);

    const detail = await asAccounting(request(app).get(`/api/uc003/adjustments/${bonusId}`));
    expect(detail.status).toBe(200);
    expect(detail.body.data.staffName).toBe('Test Adjustee');
    expect(detail.body.data.cpfApplicable).toBe(true);
  });

  test('PATCH updates only the supplied fields', async () => {
    const response = await asManager(request(app).patch(`/api/uc003/adjustments/${bonusId}`)).send({
      amount: 250,
    });
    expect(response.status).toBe(200);
    expect(response.body.data.amount).toBe('250.00');
    expect(response.body.data.reason).toBe('Retention bonus for July'); // untouched
    expect(response.body.data.adjustmentType).toBe('bonus'); // untouched
  });

  test('§5.4 fold-in: calculate applies adjustments to gross and CPF wage base', async () => {
    const run = await asAccounting(request(app).post(`/api/uc003/periods/${periodId}/calculate`));
    expect(run.status).toBe(201);

    const lines = await asAccounting(
      request(app).get(`/api/uc003/periods/${periodId}/lines?search=T-ADJ1`)
    );
    const line = lines.body.data.lines[0];
    // 612 hours + 250 bonus − 50 deduction
    expect(line.adjustmentsTotal).toBe('200.00');
    expect(line.grossTotal).toBe('812.00');
    // CPF wage base = 612 + 250 (bonus only, deduction is non-CPF) = 862:
    // employee floor(862 × 20%) = 172; total round(318.94) = 319 -> employer 147.
    expect(line.cpfEmployee).toBe('172.00');
    expect(line.cpfEmployer).toBe('147.00');
    // SDL on the FULL gross 812 × 0.25% = 2.03 (employer-borne).
    expect(line.sdl).toBe('2.03');
    expect(line.netPay).toBe('640.00'); // 812 − 172, SDL untouched
  });

  test('DELETE is a soft delete: 204, gone from the list, next run excludes it', async () => {
    const response = await asManager(request(app).delete(`/api/uc003/adjustments/${deductionId}`));
    expect(response.status).toBe(204);

    const list = await asAccounting(request(app).get(`/api/uc003/adjustments?periodId=${periodId}`));
    expect(list.body.data.adjustments).toHaveLength(1);

    // The row still exists physically (soft delete), just flagged.
    const { rows } = await pool.query(
      `SELECT deleted_at FROM payroll_adjustments WHERE id = $1`,
      [deductionId]
    );
    expect(rows[0].deleted_at).not.toBeNull();

    // Recalculate: only the bonus remains -> gross 862, net 690.
    await asAccounting(request(app).post(`/api/uc003/periods/${periodId}/recalculate`));
    const lines = await asAccounting(
      request(app).get(`/api/uc003/periods/${periodId}/lines?search=T-ADJ1`)
    );
    expect(lines.body.data.lines[0].grossTotal).toBe('862.00');
    expect(lines.body.data.lines[0].netPay).toBe('690.00');
  });

  test('every mutation wrote an audit row (§4.6)', async () => {
    const { rows } = await pool.query(
      `SELECT action, COUNT(*)::int AS count
       FROM uc003_audit_log
       WHERE entity = 'payroll_adjustment' AND entity_id = ANY($1::uuid[])
       GROUP BY action`,
      [[bonusId, deductionId]]
    );
    const byAction = Object.fromEntries(rows.map((row) => [row.action, row.count]));
    expect(byAction.create).toBe(2);
    expect(byAction.update).toBe(1);
    expect(byAction.delete).toBe(1);
  });
});

describe('period lock (§4.5)', () => {
  test('409 on create, update and delete once the period is approved', async () => {
    await pool.query(`UPDATE pay_period SET status = 'approved' WHERE id = $1`, [periodId]);

    const create = await asManager(request(app).post('/api/uc003/adjustments')).send({
      staffId,
      periodId,
      adjustmentType: 'bonus',
      amount: 10,
      reason: 'too late for this',
    });
    expect(create.status).toBe(409);
    expect(create.body.error.code).toBe('PERIOD_LOCKED');

    const patch = await asManager(request(app).patch(`/api/uc003/adjustments/${bonusId}`)).send({
      amount: 300,
    });
    expect(patch.status).toBe(409);

    const remove = await asManager(request(app).delete(`/api/uc003/adjustments/${bonusId}`));
    expect(remove.status).toBe(409);
  });
});
