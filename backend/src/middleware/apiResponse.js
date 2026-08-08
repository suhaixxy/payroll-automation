// Standard API response shape (UC-003 guide §2.5), attached to res so
// endpoints stay one-liners:
//   success: { "success": true, "data": {...}, "meta": {...} }
//   error:   { "success": false, "error": { "code", "message", "details" } }
//
// New UC-003 endpoints must use these helpers. Pre-existing endpoints keep
// their legacy shapes until their use case owner migrates them.

function apiResponse(req, res, next) {
  res.ok = (data, meta) =>
    res.status(200).json({ success: true, data, ...(meta !== undefined ? { meta } : {}) });

  res.created = (data, meta) =>
    res.status(201).json({ success: true, data, ...(meta !== undefined ? { meta } : {}) });

  res.noContent = () => res.status(204).send();

  /**
   * @param {number} status - HTTP code (400/401/403/404/409/422/500).
   * @param {string} code - stable machine-readable code, e.g. 'PERIOD_NOT_VALIDATED'.
   * @param {string} message - human-readable explanation.
   * @param {Array} [details] - per-field validation errors etc.
   */
  res.fail = (status, code, message, details = []) =>
    res.status(status).json({ success: false, error: { code, message, details } });

  next();
}

module.exports = apiResponse;
