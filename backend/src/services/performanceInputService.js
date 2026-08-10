// UC-003 phase 5: performance inputs CRUD (guide §5.3, §6) — the incentive
// drivers for full-timers (quantity × unit_value per input type).
//
// Same rules as adjustments (guide §2.2/§2.3/§2.6/§4.5):
//   - referenced staff and period must exist
//   - one LIVE row per (staff, period, input_type) — duplicates are a 409
//   - mutations refused with 409 once the period is approved or paid
//   - DELETE is a SOFT delete; every mutation writes to uc003_audit_log
//
// Saving an input does not rewrite an existing run — the resolve loop
// (§5.8) recalculates afterwards so the incomplete line turns complete.

const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');
const { logUc003Action } = require('./uc003AuditService');
const { uc003Locked } = require('../../../shared/payrollStatus.json');

const SELECT_INPUT = `
  SELECT i.id,
         i.staff_id AS "staffId",
         s.full_name AS "staffName",
         s.external_ref AS "externalRef",
         i.period_id AS "periodId",
         i.input_type AS "inputType",
         i.quantity,
         i.unit_value AS "unitValue",
         i.notes,
         to_char(i.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS "createdAt",
         to_char(i.updated_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS "updatedAt"
  FROM performance_inputs i
  JOIN staff s ON s.id = i.staff_id`;

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
  const rows = await sequelize.query(`${SELECT_INPUT} WHERE i.id = :id AND i.deleted_at IS NULL`, {
    replacements: { id },
    type: QueryTypes.SELECT,
  });
  if (!rows[0]) return { error: 'INPUT_NOT_FOUND' };
  return { data: rows[0] };
}

async function list({ periodId, staffId } = {}) {
  const filters = ['i.deleted_at IS NULL'];
  const replacements = {};
  if (periodId) {
    filters.push('i.period_id = :periodId');
    replacements.periodId = periodId;
  }
  if (staffId) {
    filters.push('i.staff_id = :staffId');
    replacements.staffId = staffId;
  }
  const inputs = await sequelize.query(
    `${SELECT_INPUT} WHERE ${filters.join(' AND ')} ORDER BY s.external_ref, i.input_type`,
    { replacements, type: QueryTypes.SELECT }
  );
  return { data: { performanceInputs: inputs } };
}

async function create({ staffId, periodId, inputType, quantity, unitValue, notes }, actor) {
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

  // One live row per metric (§3.2) — entering it twice is a data-entry
  // mistake, not something the engine should silently sum.
  const duplicates = await sequelize.query(
    `SELECT id FROM performance_inputs
     WHERE staff_id = :staffId AND period_id = :periodId AND input_type = :inputType
       AND deleted_at IS NULL`,
    { replacements: { staffId, periodId, inputType }, type: QueryTypes.SELECT }
  );
  if (duplicates[0]) return { error: 'DUPLICATE_INPUT', inputType };

  const [[created]] = await sequelize.query(
    `INSERT INTO performance_inputs
       (staff_id, period_id, input_type, quantity, unit_value, notes, created_by)
     VALUES (:staffId, :periodId, :inputType, :quantity, :unitValue, :notes, :actorId)
     RETURNING id`,
    {
      replacements: {
        staffId,
        periodId,
        inputType,
        quantity: quantity.toFixed(2),
        unitValue: unitValue.toFixed(2),
        notes: notes || null,
        actorId: actor.id,
      },
    }
  );

  const result = await getById(created.id);
  await logUc003Action({
    entity: 'performance_input',
    entityId: created.id,
    action: 'create',
    after: result.data,
    actorId: actor.id,
    actorRole: actor.role,
  });
  return result;
}

// PATCH semantics: only supplied fields change; staff/period/input_type are
// immutable — a misfiled input is deleted and recreated.
async function update(id, changes, actor) {
  const existing = await getById(id);
  if (existing.error) return existing;

  const locked = await periodLockError(existing.data.periodId);
  if (locked) return locked;

  const sets = ['updated_by = :actorId', 'updated_at = now()'];
  const replacements = { id, actorId: actor.id };
  if (changes.quantity !== undefined) {
    sets.push('quantity = :quantity');
    replacements.quantity = changes.quantity.toFixed(2);
  }
  if (changes.unitValue !== undefined) {
    sets.push('unit_value = :unitValue');
    replacements.unitValue = changes.unitValue.toFixed(2);
  }
  if (changes.notes !== undefined) {
    sets.push('notes = :notes');
    replacements.notes = changes.notes || null;
  }

  await sequelize.query(`UPDATE performance_inputs SET ${sets.join(', ')} WHERE id = :id`, {
    replacements,
  });

  const updated = await getById(id);
  await logUc003Action({
    entity: 'performance_input',
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
    `UPDATE performance_inputs SET deleted_at = now(), updated_by = :actorId WHERE id = :id`,
    { replacements: { id, actorId: actor.id } }
  );

  await logUc003Action({
    entity: 'performance_input',
    entityId: id,
    action: 'delete',
    before: existing.data,
    actorId: actor.id,
    actorRole: actor.role,
  });
  return { data: null };
}

module.exports = { list, getById, create, update, softDelete };
