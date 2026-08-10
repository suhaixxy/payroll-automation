// Last-resort handler for uncaught errors. Emits the standard error shape
// (guide §2.5): { success: false, error: { code, message, details } }.
// Endpoint-level failures (400/401/403/404/409/422) are returned by the
// endpoints themselves; anything landing here is a bug or an outage.

function errorHandler(err, req, res, next) {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: {
      code: err.code || "INTERNAL_ERROR",
      message: err.message || "Internal server error",
      details: [],
    },
  });
}

module.exports = errorHandler;
