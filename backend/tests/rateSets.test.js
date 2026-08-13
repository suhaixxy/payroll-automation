// UC-003 phase 6: statutory rate set endpoints — reads for any authenticated
// user, POST creates a NEW VERSION (manager only) that supersedes the
// current one by closing its effective_to. No PATCH/DELETE exists at all.
// The created version lives far in the future (2099) and the superseded
// set's effective_to is restored in afterAll, so other suites see no change.

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/database');
const { initializeDatabase } = require('../src/db/initializeDatabase');
const { sequelize } = require('../src/models');
const { createAndLogin, deleteTestUsers } = require('./helpers/authFixtures');

const ACCOUNTING_EMAIL = 'uc003-rs-accounting@test.local';
const MANAGER_EMAIL = 'uc003-rs-manager@test.local';
const PASSWORD = 'rateset-test-password';
const TEST_LABEL = 'test-2099';

let accountingToken;
let managerToken;
let supersededSetId; // the set our POST closes — restored in afterAll
let createdSetId;

const VALID_BODY = {
  versionLabel: TEST_LABEL,
  effectiveFrom: '2099-01-01',
  sdlRate: 0.0025,
  sdlMin: 2,
  sdlMax: 11.25,
  sdlWageCap: 4500,
  otMultiplier: 1.5,
  phMultiplier: 2,
  cpfOwCeiling: 8000,
  bands: [
    { ageMin: 0, ageMax: 55, employeeRate: 0.2, employerRate: 0.17, minWageThreshold: 500 },
    { ageMin: 56, ageMax: null, employeeRate: 0.18, employerRate: 0.16, minWageThreshold: 500 },
  ],
};

async function registerAndLogin(name, email, role) {
  return createAndLogin(app, { name, email, password: PASSWORD, role });
}

async function cleanup() {
  const { rows } = await pool.query(
    `SELECT id FROM statutory_rate_sets WHERE version_label = $1`,
    [TEST_LABEL]
  );
  for (const set of rows) {
    await pool.query(`DELETE FROM cpf_rate_bands WHERE rate_set_id = $1`, [set.id]);
    await pool.query(`DELETE FROM statutory_rate_sets WHERE id = $1`, [set.id]);
  }
  if (supersededSetId) {
    // Re-open the set our POST closed so other suites/dev data are untouched.
    await pool.query(`UPDATE statutory_rate_sets SET effective_to = NULL WHERE id = $1`, [
      supersededSetId,
    ]);
  }
  await deleteTestUsers(pool, [ACCOUNTING_EMAIL, MANAGER_EMAIL]);
}

beforeAll(async () => {
  await initializeDatabase();
  await cleanup();

  accountingToken = await registerAndLogin('RS Employee', ACCOUNTING_EMAIL, 'employee');
  managerToken = await registerAndLogin('RS Manager', MANAGER_EMAIL, 'manager');

  const { rows } = await pool.query(
    `SELECT id FROM statutory_rate_sets
     WHERE deleted_at IS NULL AND effective_to IS NULL
     ORDER BY effective_from DESC LIMIT 1`
  );
  supersededSetId = rows[0]?.id || null;
});

afterAll(async () => {
  await cleanup();
  await sequelize.close();
  await pool.end();
});

const asEmployee = (req) => req.set('Authorization', `Bearer ${accountingToken}`);
const asManager = (req) => req.set('Authorization', `Bearer ${managerToken}`);

describe('reads (§6: manager only)', () => {
  test('401 without a token; 403 for employee; 200 for manager', async () => {
    const anonymous = await request(app).get('/api/uc003/rate-sets');
    expect(anonymous.status).toBe(401);

    const employee = await asEmployee(request(app).get('/api/uc003/rate-sets'));
    expect(employee.status).toBe(403);
    const list = await asManager(request(app).get('/api/uc003/rate-sets'));
    expect(list.status).toBe(200);
    expect(list.body.data.rateSets.length).toBeGreaterThanOrEqual(1);
  });

  test('detail returns the full band table', async () => {
    const list = await asManager(request(app).get('/api/uc003/rate-sets'));
    const seeded = list.body.data.rateSets.find((set) => set.versionLabel === '2026-01');
    expect(seeded).toBeDefined();

    const detail = await asManager(request(app).get(`/api/uc003/rate-sets/${seeded.id}`));
    expect(detail.status).toBe(200);
    expect(detail.body.data.bands).toHaveLength(5);
    expect(detail.body.data.bands[0]).toMatchObject({
      ageMin: 0,
      ageMax: 55,
      employeeRate: '0.2000',
      employerRate: '0.1700',
    });
  });
});

describe('create new version (§6: manager only, supersede not edit)', () => {
  test('403 for employee', async () => {
    const response = await asEmployee(request(app).post('/api/uc003/rate-sets')).send(VALID_BODY);
    expect(response.status).toBe(403);
  });

  test('400 when the CPF bands have a gap', async () => {
    const response = await asManager(request(app).post('/api/uc003/rate-sets')).send({
      ...VALID_BODY,
      bands: [
        { ageMin: 0, ageMax: 55, employeeRate: 0.2, employerRate: 0.17, minWageThreshold: 500 },
        { ageMin: 57, ageMax: null, employeeRate: 0.18, employerRate: 0.16, minWageThreshold: 500 }, // gap at 56
      ],
    });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/contiguous/);
  });

  test('201 creates the new version and CLOSES the previous one', async () => {
    const response = await asManager(request(app).post('/api/uc003/rate-sets')).send(VALID_BODY);
    expect(response.status).toBe(201);
    createdSetId = response.body.data.id;
    expect(response.body.data.effectiveTo).toBeNull();
    expect(response.body.data.bands).toHaveLength(2);

    const list = await asManager(request(app).get('/api/uc003/rate-sets'));
    const superseded = list.body.data.rateSets.find((set) => set.id === supersededSetId);
    expect(superseded.effectiveTo).toBe('2098-12-31'); // day before the new version
    const current = list.body.data.rateSets.find((set) => set.id === createdSetId);
    expect(current.effectiveTo).toBeNull();
  });

  test('422 when effectiveFrom is not after the current version', async () => {
    const response = await asManager(request(app).post('/api/uc003/rate-sets')).send({
      ...VALID_BODY,
      versionLabel: 'test-2099-dup',
      effectiveFrom: '2098-01-01', // not after the now-open 2099 set
    });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('EFFECTIVE_FROM_NOT_AFTER_CURRENT');
  });

  test('runs stay pinned: calculating an old-window period still uses its old set', async () => {
    // The 2026 seeded period was calculated in earlier flows against the
    // 2026-01 set; the new 2099 set must not cover 2026 dates.
    const anyDateCheck = await pool.query(
      `SELECT version_label FROM statutory_rate_sets
       WHERE deleted_at IS NULL AND effective_from <= '2026-07-15'
         AND (effective_to IS NULL OR effective_to >= '2026-07-15')
       ORDER BY effective_from DESC LIMIT 1`
    );
    expect(anyDateCheck.rows[0].version_label).toBe('2026-01');
  });
});
