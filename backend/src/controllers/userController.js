// Auth endpoints: register, login, and "who am I" (used by the frontend to
// restore a session from a stored token). Bodies are yup-validated before
// any database access.

const yup = require('yup');
const authService = require('../services/authService');

const registerSchema = yup.object({
  name: yup.string().trim().min(2).max(100).required(),
  email: yup.string().trim().lowercase().email().max(150).required(),
  password: yup.string().min(8).max(100).required(),
  role: yup.string().oneOf(['accounting', 'manager']).default('accounting'),
});

const loginSchema = yup.object({
  email: yup.string().trim().lowercase().email().required(),
  password: yup.string().required(),
});

// POST /api/user/register
async function register(req, res, next) {
  try {
    let body;
    try {
      body = await registerSchema.validate(req.body, { stripUnknown: true });
    } catch (validationErr) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: validationErr.errors.join('; ') });
    }

    const result = await authService.registerUser(body);
    if (result.error === 'EMAIL_TAKEN') {
      return res.status(409).json({ error: 'EMAIL_TAKEN', message: 'An account with that email already exists.' });
    }

    res.status(201).json({ user: result.user });
  } catch (err) {
    next(err);
  }
}

// POST /api/user/login
async function login(req, res, next) {
  try {
    let body;
    try {
      body = await loginSchema.validate(req.body, { stripUnknown: true });
    } catch (validationErr) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: validationErr.errors.join('; ') });
    }

    const result = await authService.loginUser(body);
    if (result.error === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' });
    }

    res.status(200).json({ accessToken: result.accessToken, user: result.user });
  } catch (err) {
    next(err);
  }
}

// GET /api/user/auth — validateToken already verified the JWT and set req.user.
async function auth(req, res) {
  res.status(200).json({ user: req.user });
}

module.exports = { register, login, auth };
