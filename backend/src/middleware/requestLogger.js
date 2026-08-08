// Logs every incoming request: method, path, and timestamp.
// Helps everyone see what's actually being hit while developing/debugging.

function requestLogger(req, res, next) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
}

module.exports = requestLogger;