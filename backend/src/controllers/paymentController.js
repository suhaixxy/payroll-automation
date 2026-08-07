const paymentService = require("../services/paymentFileService");
const readinessService = require("../services/paymentReadinessService");
const hrmsSyncService = require("../services/hrmsSyncService");
const auditService = require("../services/auditService");

const context = (req) => ({ user: req.user, ipAddress: req.ip });

exports.eligiblePeriods = async (req, res, next) => {
    try {
        res.json({ rows: await readinessService.listEligiblePeriods() });
    } catch (error) { next(error); }
};

exports.preview = async (req, res, next) => {
    try {
        res.json(await readinessService.preview(req.query.payPeriodId));
    } catch (error) {
        await auditService.record({ ...context(req), action: "PAYMENT_READINESS_FAILURE", entityType: "pay_period", entityId: req.query.payPeriodId, details: { errorCode: error.code || "UNKNOWN" } }).catch(() => {});
        next(error);
    }
};

exports.generate = async (req, res, next) => {
    try {
        const result = await paymentService.generate({ payPeriodId: req.body.payPeriodId, ...context(req) });
        res.status(201).json({ message: "Payment batch generated and synchronised successfully.", data: result });
    } catch (error) {
        if (error.code && error.code !== "HRMS_SYNC_FAILURE") {
            await auditService.record({ ...context(req), action: "PAYMENT_READINESS_FAILURE", entityType: "pay_period", entityId: req.body.payPeriodId, details: { errorCode: error.code } }).catch(() => {});
        }
        next(error);
    }
};

exports.list = async (req, res, next) => {
    try { res.json(await paymentService.list(req.query)); } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
    try { res.json(await paymentService.getById(req.params.batchId)); } catch (error) { next(error); }
};

exports.download = async (req, res, next) => {
    try {
        const file = await paymentService.createCsvDownload({ batchId: req.params.batchId, ...context(req) });
        res.setHeader("Content-Type", file.mimeType);
        res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
        res.send(file.content);
    } catch (error) { next(error); }
};

exports.retryHrms = async (req, res, next) => {
    try {
        const batch = await hrmsSyncService.retry({ batchId: req.params.batchId, ...context(req) });
        res.json({ message: "HRMS synchronisation completed.", data: paymentService.serializeBatch(batch) });
    } catch (error) { next(error); }
};

exports.cancel = async (req, res, next) => {
    try {
        res.json({ message: "Payment batch cancelled.", data: await paymentService.cancel({ batchId: req.params.batchId, reason: req.body.reason, ...context(req) }) });
    } catch (error) { next(error); }
};

exports.statistics = async (req, res, next) => {
    try { res.json(await paymentService.statistics()); } catch (error) { next(error); }
};
