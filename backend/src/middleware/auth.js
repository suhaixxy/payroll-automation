// Shared auth middleware (Lab 5b pattern).
// requireAuth (alias: validateToken): checks the Authorization: Bearer
// <token> header and puts the verified payload on req.user, else 401.
// requireRole: run AFTER requireAuth; 403s anyone whose role isn't in the
// allowed list. Accepts one or more roles — e.g. requireRole('manager') for
// approvals, requireRole('manager', 'accounting') for running a calculation.
// Authorisation is enforced HERE, on the route — never in the frontend
// (hiding a button is not authorisation).

const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
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

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Only ${roles.join(' or ')} accounts may do this.`,
      });
    }
    return next();
  };
}

module.exports = { requireAuth, validateToken: requireAuth, requireRole };
