const bcrypt = require("bcrypt");
const request = require("supertest");
const { User } = require("../../src/models");

async function createAndLogin(app, { name, email, password, role }) {
  await User.create({
    full_name: name,
    email,
    password_hash: await bcrypt.hash(password, 4),
    role,
    status: "active",
  });

  const response = await request(app).post("/api/auth/login").send({ email, password });
  if (response.status !== 200) {
    throw new Error(`Test login failed for ${email}: HTTP ${response.status}`);
  }
  return response.body.accessToken;
}

async function deleteTestUsers(pool, emails) {
  await pool.query(
    `DELETE FROM uc003_audit_log
     WHERE actor_id IN (SELECT id FROM user_account WHERE email = ANY($1))`,
    [emails]
  );
  await pool.query(
    `DELETE FROM audit_log
     WHERE user_id IN (SELECT id FROM user_account WHERE email = ANY($1))`,
    [emails]
  );
  await pool.query(`DELETE FROM user_account WHERE email = ANY($1)`, [emails]);
}

module.exports = { createAndLogin, deleteTestUsers };
