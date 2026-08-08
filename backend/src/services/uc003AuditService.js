// UC-003 audit helper (guide §2.3): one row in uc003_audit_log per mutating
// action — who, what entity, what changed, when. Append-only: this module
// exposes no update or delete, and nothing else may write to the table.
//
// Distinct from services/auditService.js, which writes the legacy shared
// audit_log used by the ported engine; new UC-003 endpoints use THIS one.

const { pool } = require('../config/database');

/**
 * @param {object} entry
 * @param {string} entry.entity - e.g. 'payroll_adjustment', 'calculation_run'.
 * @param {string|null} [entry.entityId] - UUID of the affected row.
 * @param {string} entry.action - 'create'|'update'|'delete'|'calculate'|'void'|'submit'.
 * @param {object|null} [entry.before] - row state before the change (null on create).
 * @param {object|null} [entry.after] - row state after the change (null on delete).
 * @param {string} entry.actorId - user_account.id of who did it.
 * @param {string} entry.actorRole - their authenticated role at the time.
 */
async function logUc003Action({ entity, entityId = null, action, before = null, after = null, actorId, actorRole }) {
  await pool.query(
    `INSERT INTO uc003_audit_log
       (entity, entity_id, action, before_json, after_json, actor_id, actor_role)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entity,
      entityId,
      action,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      actorId,
      actorRole,
    ]
  );
}

module.exports = { logUc003Action };
