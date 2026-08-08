// UC-003 phase 4: payroll adjustments CRUD (guide §5.4, §6).
//
// Rules enforced here:
//   - referenced staff and period must exist (guide §2.6)
//   - once the period is approved or paid, every mutation is refused with a
//     409 state conflict (§4.5) — nothing about paid-out money may change
//   - DELETE is a SOFT delete (deleted_at); audit rows are never deleted
//   - every mutation writes a before/after row to uc003_audit_log (§4.6)
//
// The calculation engine folds non-deleted adjustments into gross and the
// CPF wage base (§5.4) on the NEXT run — changing an adjustment after a
// calculation deliberately does not rewrite history; recalculate instead.

const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');
const { logUc003Action } = require('./uc003AuditService');
const { uc003Locked } = require('../../../shared/payrollStatus.json');

const SELECT_ADJUSTMENT = `
  SELECT a.id,
         a.staff_id AS "staffId",
         s.full_name AS "staffName",
         s.external_ref AS "externalRef",
         a.period_id AS "periodId",
         a.adjustment_type AS "adjustmentType",
         a.amount,
         a.cpf_applicable AS "cpfApplicable",
         a.reason,
         to_char(a.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS "createdAt",
         to_char(a.updated_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS "updatedAt"
  FROM payroll_adjustments a
  JOIN staff s ON s.id = a.staff_id`;

async function periodLockError(periodId) {
  const rows = await sequelize.query(`SELECT status FROM pay_period WHERE id = :periodId`, {
    replacements: { periodId },
    type: QueryTypes.SELECT,
  });
  if (!rows[0]) return { error: 'PERIOD_NOT_FOUND' };
  if (uc003Locked.includes(rows[0].status)) {
    return { error: 'PERIOD_LOCKED', currentStatus: rows[0].status };
  }
  return null;
}

async function getById(id) {
  const rows = await sequelize.query(`${SELECT_ADJUSTMENT} WHERE a.id = :id AND a.deleted_at IS NULL`, {
    replacements: { id },
    type: QueryTypes.SELECT,
  });
  if (!rows[0]) return { error: 'ADJUSTMENT_NOT_FOUND' };
  return { data: rows[0] };
}

async function list({ periodId, staffId } = {}) {
  const filters = ['a.deleted_at IS NULL'];
  const replacements = {};
  if (periodId) {
    filters.push('a.period_id = :periodId');
    replacements.periodId = periodId;
  }
  if (staffId) {
    filters.push('a.staff_id = :staffId');
    replacements.staffId = staffId;
  }
  const adjustments = await sequelize.query(
    `${SELECT_ADJUSTMENT} WHERE ${filters.join(' AND ')} ORDER BY a.created_at DESC`,
    { replacements, type: QueryTypes.SELECT }
  );
  return { data: { adjustments } };
}

async function create({ staffId, periodId, adjustmentType, amount, cpfApplicable, reason }, actor) {
  const [staffRows, periodRows] = await Promise.all([
    sequelize.query(`SELECT id FROM staff WHERE id = :staffId`, {
      replacements: { staffId },
      type: QueryTypes.SELECT,
    }),
    sequelize.query(`SELECT id, status FROM pay_period WHERE id = :periodId`, {
      replacements: { periodId },
      type: QueryTypes.SELECT,
    }),
  ]);
  if (!staffRows[0]) return { error: 'STAFF_NOT_FOUND' };
  if (!periodRows[0]) return { error: 'PERIOD_NOT_FOUND' };
  if (uc003Locked.includes(periodRows[0].status)) {
    return { error: 'PERIOD_LOCKED', currentStatus: periodRows[0].status };
  }

  const [[created]] = await sequelize.query(
    `INSERT INTO payroll_adjustments
       (staff_id, period_id, adjustment_type, amount, cpf_applicable, reason, created_by)
     VALUES (:staffId, :periodId, :adjustmentType, :amount, :cpfApplicable, :reason, :actorId)
     RETURNING id`,
    {
      replacements: {
        staffId,
        periodId,
        adjustmentType,
        amount: amount.toFixed(2),
        cpfApplicable,
        reason,
        actorId: actor.id,
      },
    }
  );

  const result = await getById(created.id);
  await logUc003Action({
    entity: 'payroll_adjustment',
    entityId: created.id,
    action: 'create',
    after: result.data,
    actorId: actor.id,
    actorRole: actor.role,
  });
  return result;
}

// PATCH semantics (§2.1/§6): only the supplied fields change. staff/period
// are immutable — a misfiled adjustment is deleted and recreated, keeping
// the audit trail honest.
async function update(id, changes, actor) {
  const existing = await getById(id);
  if (existing.error) return existing;

  const locked = await periodLockError(existing.data.periodId);
  if (locked) return locked;

  const sets = ['updated_by = :actorId', 'updated_at = now()'];
  const replacements = { id, actorId: actor.id };
  if (changes.adjustmentType !== undefined) {
    sets.push('adjustment_type = :adjustmentType');
    replacements.adjustmentType = changes.adjustmentType;
  }
  if (changes.amount !== undefined) {
    sets.push('amount = :amount');
    replacements.amount = changes.amount.toFixed(2);
  }
  if (changes.cpfApplicable !== undefined) {
    sets.push('cpf_applicable = :cpfApplicable');
    replacements.cpfApplicable = changes.cpfApplicable;
  }
  if (changes.reason !== undefined) {
    sets.push('reason = :reason');
    replacements.reason = changes.reason;
  }

  await sequelize.query(`UPDATE payroll_adjustments SET ${sets.join(', ')} WHERE id = :id`, {
    replacements,
  });

  const updated = await getById(id);
  await logUc003Action({
    entity: 'payroll_adjustment',
    entityId: id,
    action: 'update',
    before: existing.data,
    after: updated.data,
    actorId: actor.id,
    actorRole: actor.role,
  });
  return updated;
}

async function softDelete(id, actor) {
  const existing = await getById(id);
  if (existing.error) return existing;

  const locked = await periodLockError(existing.data.periodId);
  if (locked) return locked;

  await sequelize.query(
    `UPDATE payroll_adjustments SET deleted_at = now(), updated_by = :actorId WHERE id = :id`,
    { replacements: { id, actorId: actor.id } }
  );

  await logUc003Action({
    entity: 'payroll_adjustment',
    entityId: id,
    action: 'delete',
    before: existing.data,
    actorId: actor.id,
    actorRole: actor.role,
  });
  return { data: null };
}

module.exports = { list, getById, create, update, softDelete };
