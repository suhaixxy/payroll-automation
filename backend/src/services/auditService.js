const { AuditLog } = require("../models");

const safeDetails = (details = {}) => {
  const blockedKeys = new Set([
    "password",
    "passwordHash",
    "password_hash",
    "token",
    "jwt",
    "bank_account_no",
  ]);

  return Object.fromEntries(
    Object.entries(details || {}).filter(([key]) => !blockedKeys.has(key))
  );
};

// ==========================================================
// UC-005 / shared audit API
// ==========================================================

const record = async ({
  user = null,
  action,
  entityType,
  entityId = null,
  ipAddress = null,
  details = {},
}) =>
  AuditLog.create({
    user_id: user?.id || null,
    user_role: user?.role || null,
    action,
    entity_type: entityType,
    entity_id: entityId,
    actor: user?.email || "anonymous",
    ip_address: ipAddress,
    details: safeDetails(details),
  });

// ==========================================================
// Compatibility API used by UC-001
// ==========================================================

const logAction = async ({
  entityType,
  entityId,
  action,
  actor,
  detail,
}) =>
  AuditLog.create({
    user_id: null,
    user_role: null,
    action,
    entity_type: entityType,
    entity_id: entityId,
    actor: actor || "system",
    ip_address: null,
    details: safeDetails(detail || {}),
  });

const getHistory = async (entityType, entityId, limit = 10) => {
  const rows = await AuditLog.findAll({
    where: {
      entity_type: entityType,
      entity_id: entityId,
    },
    order: [["created_at", "DESC"]],
    limit,
  });

  return rows.map((row) => {
    const values = row.get({ plain: true });

    return {
      action: values.action,
      actor: values.actor,
      detail: values.details,
      createdAt: values.created_at || values.createdAt,
    };
  });
};

module.exports = {
  record,
  logAction,
  getHistory,
};