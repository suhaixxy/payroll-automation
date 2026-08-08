// UC-003: append-only audit trail for payroll line, adjustment, and
// performance input mutations. Every create/update/delete is logged with
// who did it, when, and a before/after diff of the changed fields.

const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

/**
 * Record an edit in the audit log.
 * @param {string} entityType - 'payroll_line' | 'adjustment' | 'performance_input'
 * @param {string} entityId - UUID of the affected record
 * @param {string} action - 'created' | 'updated' | 'deleted'
 * @param {object} actor - { id, name|fullName }
 * @param {object} changes - { fieldName: { from, to } } for updates; snapshot for creates
 */
async function recordEdit(entityType, entityId, action, actor, changes = {}) {
  await sequelize.query(
    `INSERT INTO payroll_edit_log (entity_type, entity_id, action, user_id, user_name, changes)
     VALUES (:entityType, :entityId, :action, :userId, :userName, :changes::jsonb)`,
    {
      replacements: {
        entityType,
        entityId,
        action,
        userId: actor?.id || null,
        userName: actor?.fullName || actor?.name || actor?.email || 'System',
        changes: JSON.stringify(changes),
      },
    }
  );
}

/**
 * Retrieve the full edit history for a record, newest first.
 */
async function getHistory(entityType, entityId) {
  const rows = await sequelize.query(
    `SELECT id, action, user_name, changes, created_at AS "createdAt"
     FROM payroll_edit_log
     WHERE entity_type = :entityType AND entity_id = :entityId
     ORDER BY created_at DESC`,
    { replacements: { entityType, entityId }, type: QueryTypes.SELECT }
  );
  return rows;
}

/**
 * Retrieve the most recent edits across ALL entities, newest first.
 * Joins with staff/payroll_line to show human-readable context.
 */
async function getRecentEdits(limit = 50) {
  const rows = await sequelize.query(
    `SELECT el.id, el.entity_type AS "entityType", el.entity_id AS "entityId",
            el.action, el.user_name AS "userName", el.changes, el.created_at AS "createdAt",
            s.full_name AS "staffName", s.external_ref AS "staffRef"
     FROM payroll_edit_log el
     LEFT JOIN payroll_lines pl ON el.entity_type = 'payroll_line' AND pl.id = el.entity_id
     LEFT JOIN staff s ON pl.staff_id = s.id
     ORDER BY el.created_at DESC
     LIMIT :limit`,
    { replacements: { limit }, type: QueryTypes.SELECT }
  );
  return rows;
}

module.exports = { recordEdit, getHistory, getRecentEdits };
