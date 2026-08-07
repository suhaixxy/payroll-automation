const yup = require("yup");
const databaseUuid = () => yup.string().trim().matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Must be a valid database UUID");

exports.generateSchema = yup.object({
    payPeriodId: databaseUuid().required(),
}).noUnknown(true);

exports.previewSchema = yup.object({ payPeriodId: databaseUuid().required() }).noUnknown(true);
exports.batchParamsSchema = yup.object({ batchId: databaseUuid().required() }).noUnknown(true);
exports.staffParamsSchema = yup.object({ staffId: databaseUuid().required() }).noUnknown(true);
exports.listSchema = yup.object({
    status: yup.string().oneOf(["generating", "generated", "hrms_sync_pending", "hrms_sync_failed", "completed", "cancelled"]).optional(),
    search: yup.string().trim().max(100).optional(),
    limit: yup.number().integer().min(1).max(100).optional(),
    offset: yup.number().integer().min(0).optional(),
}).noUnknown(true);

exports.cancelSchema = yup.object({
    reason: yup.string().trim().min(5).max(500).required(),
}).noUnknown(true);

exports.bankDetailsSchema = yup.object({
    bankCode: yup.string().trim().matches(/^[A-Za-z0-9-]{3,20}$/).required(),
    bankAccountNumber: yup.string().trim().matches(/^[A-Za-z0-9-]{5,50}$/).required(),
}).noUnknown(true);
