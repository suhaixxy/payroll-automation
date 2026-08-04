const { AuditLog } = require("../models");

const safeDetails = (details = {}) => {
    const blockedKeys = new Set(["password", "passwordHash", "password_hash", "token", "jwt", "bank_account_no"]);
    return Object.fromEntries(Object.entries(details).filter(([key]) => !blockedKeys.has(key)));
};

exports.record = async ({ user = null, action, entityType, entityId = null, ipAddress = null, details = {} }) => AuditLog.create({
    user_id: user?.id || null,
    user_role: user?.role || null,
    action,
    entity_type: entityType,
    entity_id: entityId,
    actor: user?.email || "anonymous",
    ip_address: ipAddress,
    details: safeDetails(details),
});
