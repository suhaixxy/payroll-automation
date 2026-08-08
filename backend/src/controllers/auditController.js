const { AuditLog } = require("../models");
const AppError = require("../utils/AppError");

exports.list = async (req, res, next) => {
    try {
        const limit = Math.min(Number(req.query.limit || 50), 100);
        const offset = Number(req.query.offset || 0);
        const result = await AuditLog.findAndCountAll({ order: [["created_at", "DESC"]], limit, offset });
        res.json({ count: result.count, rows: result.rows });
    } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
    try {
        const log = await AuditLog.findByPk(req.params.id);
        if (!log) throw new AppError(404, "AUDIT_LOG_NOT_FOUND", "Audit log not found.");
        res.json(log);
    } catch (error) { next(error); }
};
