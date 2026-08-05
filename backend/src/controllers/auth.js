// Shared auth middleware (Lab 5b pattern).
// validateToken: checks the Authorization: Bearer <token> header and puts
// the verified payload on req.user, else 401.
// requireRole: run AFTER validateToken; 403s anyone whose role doesn't match
// (e.g. only managers may approve payroll in UC-004).

const jwt = require('jsonwebtoken');

function validateToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED', message: 'Log in to use this endpoint.' });
  }

  try {
    req.user = jwt.verify(token, process.env.APP_SECRET);
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Session is invalid or expired — log in again.' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'FORBIDDEN', message: `Only ${role} accounts may do this.` });
    }
    return next();
  };
}

module.exports = { validateToken, requireRole };
