// Auth business logic (Lab 5a pattern): bcrypt for password hashing,
// jsonwebtoken for the session token. Controllers translate the return
// values into HTTP responses — no res/req in here.

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// What goes inside the JWT (and back to the client). Never include the
// password hash.
function toTokenPayload(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/**
 * Creates a login account with a bcrypt-hashed password.
 * Returns { user } or { error: 'EMAIL_TAKEN' }.
 */
async function registerUser({ name, email, password, role }) {
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    return { error: 'EMAIL_TAKEN' };
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashed, role });
  return { user: toTokenPayload(user) };
}

/**
 * Verifies credentials and signs a JWT.
 * Returns { accessToken, user } or { error: 'INVALID_CREDENTIALS' }.
 * Wrong email and wrong password give the same error on purpose, so the
 * response doesn't reveal which emails have accounts.
 */
async function loginUser({ email, password }) {
  const user = await User.findOne({ where: { email } });
  if (!user) {
    return { error: 'INVALID_CREDENTIALS' };
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    return { error: 'INVALID_CREDENTIALS' };
  }

  const payload = toTokenPayload(user);
  const accessToken = jwt.sign(payload, process.env.APP_SECRET, { expiresIn: '8h' });
  return { accessToken, user: payload };
}

module.exports = { registerUser, loginUser };
