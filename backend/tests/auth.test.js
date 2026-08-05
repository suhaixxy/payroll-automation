// Auth tests: register -> login -> session restore, plus the middleware
// guards (401 without a token, 403 for the wrong role).

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/database');
const { initializeDatabase } = require('../src/db/initializeDatabase');
const { sequelize, syncUc003Tables, User } = require('../src/models');
const { requireRole } = require('../src/middleware/auth');

const TEST_EMAIL = 'auth-tester@test.local';
const TEST_PASSWORD = 'auth-test-password';

describe('auth endpoints', () => {
  beforeAll(async () => {
    await initializeDatabase();
    await syncUc003Tables();
    // A previous run may have died before cleanup.
    await User.destroy({ where: { email: TEST_EMAIL } });
  });

  afterAll(async () => {
    await User.destroy({ where: { email: TEST_EMAIL } });
    await pool.end();
    await sequelize.close();
  });

  test('register creates an account and never echoes the password', async () => {
    const response = await request(app)
      .post('/api/user/register')
      .send({ name: 'Auth Tester', email: TEST_EMAIL, password: TEST_PASSWORD, role: 'accounting' });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe(TEST_EMAIL);
    expect(response.body.user.password).toBeUndefined();

    // The stored password must be a bcrypt hash, not the plaintext.
    const stored = await User.findOne({ where: { email: TEST_EMAIL } });
    expect(stored.password).not.toBe(TEST_PASSWORD);
    expect(stored.password.startsWith('$2')).toBe(true);
  });

  test('registering the same email twice returns 409', async () => {
    const response = await request(app)
      .post('/api/user/register')
      .send({ name: 'Auth Tester', email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(response.status).toBe(409);
  });

  test('register rejects an invalid body with 400', async () => {
    const response = await request(app)
      .post('/api/user/register')
      .send({ name: 'X', email: 'not-an-email', password: 'short' });
    expect(response.status).toBe(400);
  });

  test('login returns a working access token', async () => {
    const login = await request(app)
      .post('/api/user/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeDefined();

    // The token restores the session via GET /user/auth.
    const auth = await request(app)
      .get('/api/user/auth')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(auth.status).toBe(200);
    expect(auth.body.user.email).toBe(TEST_EMAIL);
  });

  test('login with a wrong password returns 401', async () => {
    const response = await request(app)
      .post('/api/user/login')
      .send({ email: TEST_EMAIL, password: 'definitely-wrong' });
    expect(response.status).toBe(401);
  });

  test('GET /user/auth without a token returns 401', async () => {
    const response = await request(app).get('/api/user/auth');
    expect(response.status).toBe(401);
  });
});

describe('requireRole middleware', () => {
  function run(role) {
    const req = { user: { role } };
    const res = {
      statusCode: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json() {
        return this;
      },
    };
    let nextCalled = false;
    requireRole('manager')(req, res, () => {
      nextCalled = true;
    });
    return { nextCalled, statusCode: res.statusCode };
  }

  test('lets the matching role through', () => {
    expect(run('manager')).toEqual({ nextCalled: true, statusCode: null });
  });

  test('rejects any other role with 403', () => {
    expect(run('accounting')).toEqual({ nextCalled: false, statusCode: 403 });
  });
});
