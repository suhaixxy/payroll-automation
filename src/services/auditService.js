// Shared audit logger (per the design doc's "Audit Logger" component, used
// by all use cases). Records who did what and when, so past actions
// (e.g. sync runs) can be looked up later instead of only ever seeing the
// current state.

const { pool } = require("../config/database");

async function logAction({ entityType, entityId, action, actor, detail }) {
  await pool.query(
    `INSERT INTO audit_log (entity_type, entity_id, action, actor, detail) VALUES ($1, $2, $3, $4, $5)`,
    [entityType, entityId, action, actor, detail ? JSON.stringify(detail) : null]
  );
}

async function getHistory(entityType, entityId, limit = 10) {
  const { rows } = await pool.query(
    `SELECT action, actor, detail, created_at
     FROM audit_log
     WHERE entity_type = $1 AND entity_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [entityType, entityId, limit]
  );
  return rows.map((row) => ({
    action: row.action,
    actor: row.actor,
    detail: row.detail,
    createdAt: row.created_at.toISOString(),
  }));
}

module.exports = { logAction, getHistory };