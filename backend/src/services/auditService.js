// Writes one row per significant action to the shared audit_log table
// (created by migration 001). Append-only: nothing in the codebase may
// UPDATE or DELETE audit rows.

const { pool } = require('../config/database');

/**
 * Records who did what to which entity.
 * @param {object} entry
 * @param {string} entry.entityType - e.g. 'pay_period', 'payroll_line'.
 * @param {string} entry.entityId - UUID of the affected row.
 * @param {string} entry.action - e.g. 'payroll_calculated'.
 * @param {string} entry.actor - email of the user (or 'system').
 * @param {object} [entry.detail] - free-form JSON context (before/after, totals).
 */
async function logAction({ entityType, entityId, action, actor, detail }) {
  await pool.query(
    `INSERT INTO audit_log (entity_type, entity_id, action, actor, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [entityType, entityId, action, actor, detail ? JSON.stringify(detail) : null]
  );
}

module.exports = { logAction };
