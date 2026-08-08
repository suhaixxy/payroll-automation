function errorHandler(err, req, res, next) {
  if (process.env.NODE_ENV !== "test") {
    console.error(err.stack || err);
  }

  const status = err.status || 500;

  res.status(status).json({
    error: err.code || "INTERNAL_SERVER_ERROR",
    message:
      status === 500 && process.env.NODE_ENV === "production"
        ? "Something went wrong."
        : err.message || "Something went wrong.",
    details: Array.isArray(err.details) ? err.details : [],
  });
}

module.exports = errorHandler;