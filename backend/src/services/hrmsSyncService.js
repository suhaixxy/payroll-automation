const { PaymentBatch, PaymentBatchItem, PayPeriod, sequelize } = require("../models");
const hrmsAdapter = require("../adapters/hrmsAdapter");
const auditService = require("./auditService");
const payslipService = require("./payslipService");
const AppError = require("../utils/AppError");

const loadBatch = async (batchId) => PaymentBatch.findByPk(batchId, {
    include: [{ model: PaymentBatchItem, as: "items" }],
});

const buildPayload = (batch) => ({
    batchReference: batch.batch_reference,
    payPeriodId: batch.pay_period_id,
    totalAmount: Number(batch.total_amount).toFixed(2),
    payrollRecords: batch.items.map((item) => ({
        employeeReference: item.employee_reference,
        grossPay: Number(item.gross_pay).toFixed(2),
        incentivePay: Number(item.incentive_pay).toFixed(2),
        cpfAmount: Number(item.cpf_amount).toFixed(2),
        sdlAmount: Number(item.sdl_amount).toFixed(2),
        otherDeduction: Number(item.other_deduction).toFixed(2),
        netPay: Number(item.net_pay).toFixed(2),
    })),
});

exports.sync = async ({ batchId, user, ipAddress, isRetry = false }) => {
    const batch = await loadBatch(batchId);
    if (!batch) throw new AppError(404, "PAYMENT_BATCH_NOT_FOUND", "Payment batch not found.");
    if (batch.status === "cancelled") throw new AppError(409, "INVALID_PAYMENT_STATE", "A cancelled payment batch cannot be synchronised.");
    if (batch.status === "completed") return batch;

    if (isRetry) {
        await auditService.record({ user, action: "HRMS_RETRY", entityType: "payment_batch", entityId: batch.id, ipAddress });
    }
    await batch.update({ status: "hrms_sync_pending", hrms_sync_status: "pending", hrms_error_message: null });
    await auditService.record({ user, action: "HRMS_SYNC_START", entityType: "payment_batch", entityId: batch.id, ipAddress, details: { retry: isRetry } });

    const result = await hrmsAdapter.sync(buildPayload(batch));
    if (!result.success) {
        await batch.update({ status: "hrms_sync_failed", hrms_sync_status: "failed", hrms_error_message: result.errorMessage });
        await auditService.record({ user, action: "HRMS_SYNC_FAILURE", entityType: "payment_batch", entityId: batch.id, ipAddress, details: { errorCode: result.errorCode } });
        throw new AppError(502, "HRMS_SYNC_FAILURE", "Payment file retained; HRMS synchronisation requires a manual retry.", [{ paymentBatchId: batch.id }]);
    }

    let payslips;
    await sequelize.transaction(async (transaction) => {
        await batch.update({
            status: "completed",
            hrms_sync_status: "completed",
            hrms_reference: result.externalReference,
            hrms_error_message: null,
            hrms_synced_at: new Date(),
        }, { transaction });
        await PayPeriod.update({ status: "payment_ready" }, { where: { id: batch.pay_period_id }, transaction });
        payslips = await payslipService.generateForBatch({ batchId: batch.id, transaction });
    });
    await auditService.record({ user, action: "HRMS_SYNC_SUCCESS", entityType: "payment_batch", entityId: batch.id, ipAddress, details: { externalReference: result.externalReference, acceptedRecords: result.acceptedRecords } });
    await payslipService.auditGenerated({ payslips, user, ipAddress });
    return loadBatch(batch.id);
};

exports.retry = async ({ batchId, user, ipAddress }) => {
    const batch = await PaymentBatch.findByPk(batchId);
    if (!batch) throw new AppError(404, "PAYMENT_BATCH_NOT_FOUND", "Payment batch not found.");
    if (batch.status !== "hrms_sync_failed") throw new AppError(409, "INVALID_HRMS_RETRY", "Only a failed HRMS synchronisation can be retried.");
    return exports.sync({ batchId, user, ipAddress, isRetry: true });
};
