const crypto = require("crypto");
const { Op } = require("sequelize");
const { sequelize, PaymentBatch, PaymentBatchItem, PayPeriod, Staff, User } = require("../models");
const readinessService = require("./paymentReadinessService");
const hrmsSyncService = require("./hrmsSyncService");
const auditService = require("./auditService");
const generateGiroCsv = require("../utils/giroFileFormatter");
const generateReference = require("../utils/generateReference");
const maskBankAccount = require("../utils/maskBankAccount");
const AppError = require("../utils/AppError");

const completeBatchIncludes = [
    { model: PaymentBatchItem, as: "items" },
    { model: PayPeriod, as: "payPeriod", attributes: ["id", "start_date", "end_date", "status"] },
    { model: User, as: "generator", attributes: ["id", "full_name"] },
];

const loadCompleteBatch = (batchId) => PaymentBatch.findByPk(batchId, {
    include: completeBatchIncludes,
});

const buildPaymentFile = (batch, items) => {
    const file = generateGiroCsv(batch, items);
    return {
        fileName: file.filename,
        mimeType: `${file.mimeType}; charset=utf-8`,
        content: file.content,
        sizeBytes: Buffer.byteLength(file.content, "utf8"),
        checksumSha256: crypto.createHash("sha256").update(file.content, "utf8").digest("hex"),
    };
};

const serializeBatch = (batch) => ({
    id: batch.id,
    payPeriodId: batch.pay_period_id,
    batchReference: batch.batch_reference,
    fileFormat: batch.file_format,
    paymentType: batch.file_format?.toUpperCase() || null,
    currency: "SGD",
    employeeCount: batch.employee_count,
    totalAmount: Number(batch.total_amount).toFixed(2),
    status: batch.status,
    hrmsSyncStatus: batch.hrms_sync_status,
    hrmsReference: batch.hrms_reference,
    hrmsErrorMessage: batch.hrms_error_message,
    generatedAt: batch.generated_at,
    hrmsSyncedAt: batch.hrms_synced_at,
    cancelledAt: batch.cancelled_at,
    cancellationReason: batch.cancellation_reason,
    createdAt: batch.createdAt,
    payPeriod: batch.payPeriod ? {
        id: batch.payPeriod.id,
        startDate: batch.payPeriod.start_date,
        endDate: batch.payPeriod.end_date,
        status: batch.payPeriod.status,
    } : null,
    generatedBy: batch.generator ? {
        id: batch.generator.id,
        fullName: batch.generator.full_name,
    } : null,
});

exports.generate = async ({ payPeriodId, user, ipAddress }) => {
    let createdBatch;
    await sequelize.transaction({ isolationLevel: "SERIALIZABLE" }, async (transaction) => {
        const readiness = await readinessService.assess(payPeriodId, transaction);
        createdBatch = await PaymentBatch.create({
            pay_period_id: payPeriodId,
            batch_reference: generateReference("PAY"),
            file_format: "giro",
            employee_count: readiness.payrollLines.length,
            total_amount: readiness.totalAmount,
            status: "generated",
            hrms_sync_status: "not_started",
            generated_by: user.id,
            generated_at: new Date(),
        }, { transaction });

        await PaymentBatchItem.bulkCreate(readiness.payrollLines.map((line) => ({
            payment_batch_id: createdBatch.id,
            payroll_line_id: line.id,
            staff_id: line.staff_id,
            employee_reference: line.staff.external_ref,
            employee_name: line.staff.full_name,
            bank_code: line.staff.bank_code,
            bank_account_no: line.staff.bank_account_no,
            gross_pay: line.gross_pay,
            incentive_pay: line.incentive_pay,
            cpf_amount: line.cpf_amount,
            sdl_amount: line.sdl_amount,
            other_deduction: 0,
            net_pay: line.net_pay,
            payment_reference: `${createdBatch.batch_reference}-${line.staff.external_ref}`,
        })), { transaction });
    });

    await auditService.record({ user, action: "PAYMENT_BATCH_GENERATED", entityType: "payment_batch", entityId: createdBatch.id, ipAddress, details: { payPeriodId, employeeCount: createdBatch.employee_count, totalAmount: createdBatch.total_amount } });
    const syncedBatch = await hrmsSyncService.sync({ batchId: createdBatch.id, user, ipAddress });
    const completeBatch = await loadCompleteBatch(syncedBatch.id);
    return serializeBatch(completeBatch);
};

exports.list = async ({ status, search, limit = 25, offset = 0 }) => {
    const where = {};
    if (status) where.status = status;
    if (search) where[Op.or] = [
        { batch_reference: { [Op.iLike]: `%${search}%` } },
        { hrms_reference: { [Op.iLike]: `%${search}%` } },
    ];
    const result = await PaymentBatch.findAndCountAll({
        where,
        include: [
            { model: PayPeriod, as: "payPeriod", attributes: ["id", "start_date", "end_date", "status"] },
            { model: User, as: "generator", attributes: ["id", "full_name"] },
        ],
        order: [["generated_at", "DESC"]],
        limit: Math.min(Number(limit), 100),
        offset: Number(offset),
        distinct: true,
    });
    return { count: result.count, rows: result.rows.map(serializeBatch) };
};

exports.getById = async (batchId) => {
    const batch = await loadCompleteBatch(batchId);
    if (!batch) throw new AppError(404, "PAYMENT_BATCH_NOT_FOUND", "Payment batch not found.");
    const paymentFile = batch.items.length ? buildPaymentFile(batch, batch.items) : null;
    return {
        ...serializeBatch(batch),
        paymentFile: paymentFile ? {
            fileName: paymentFile.fileName,
            mimeType: paymentFile.mimeType,
            sizeBytes: paymentFile.sizeBytes,
            checksumSha256: paymentFile.checksumSha256,
        } : null,
        items: batch.items.map((item) => ({
            id: item.id,
            staffId: item.staff_id,
            employeeReference: item.employee_reference,
            employeeName: item.employee_name,
            bankCode: item.bank_code,
            bankAccountNumber: maskBankAccount(item.bank_account_no),
            grossPay: Number(item.gross_pay).toFixed(2),
            incentivePay: Number(item.incentive_pay).toFixed(2),
            cpfAmount: Number(item.cpf_amount).toFixed(2),
            sdlAmount: Number(item.sdl_amount).toFixed(2),
            netPay: Number(item.net_pay).toFixed(2),
            paymentReference: item.payment_reference,
        })),
    };
};

exports.createCsvDownload = async ({ batchId, user, ipAddress }) => {
    const batch = await PaymentBatch.findByPk(batchId, { include: [{ model: PaymentBatchItem, as: "items" }] });
    if (!batch) throw new AppError(404, "PAYMENT_BATCH_NOT_FOUND", "Payment batch not found.");
    if (batch.status === "cancelled") throw new AppError(409, "PAYMENT_BATCH_CANCELLED", "A cancelled payment file cannot be downloaded.");
    if (!batch.items.length) throw new AppError(409, "PAYMENT_FILE_EMPTY", "The payment batch contains no payment records.");
    await auditService.record({ user, action: "PAYMENT_FILE_DOWNLOAD", entityType: "payment_batch", entityId: batch.id, ipAddress, details: { fileFormat: "csv" } });
    return buildPaymentFile(batch, batch.items);
};

exports.cancel = async ({ batchId, reason, user, ipAddress }) => {
    const batch = await PaymentBatch.findByPk(batchId);
    if (!batch) throw new AppError(404, "PAYMENT_BATCH_NOT_FOUND", "Payment batch not found.");
    if (!["generated", "hrms_sync_failed"].includes(batch.status)) throw new AppError(409, "INVALID_CANCELLATION", "Only generated or HRMS-failed batches may be cancelled.");
    await batch.update({ status: "cancelled", cancelled_by: user.id, cancelled_at: new Date(), cancellation_reason: reason });
    await PayPeriod.update({ status: "approved" }, { where: { id: batch.pay_period_id, status: { [Op.ne]: "payment_ready" } } });
    await auditService.record({ user, action: "PAYMENT_BATCH_CANCELLED", entityType: "payment_batch", entityId: batch.id, ipAddress, details: { reason } });
    return serializeBatch(batch);
};

exports.statistics = async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const nextYearStart = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
    const [batches, activeStaff, currentPayPeriod, currentYearBatchCount, pendingApprovals] = await Promise.all([
        PaymentBatch.findAll({ attributes: ["status", "total_amount"] }),
        Staff.count({ where: { status: "active" } }),
        PayPeriod.findOne({
            where: {
                start_date: { [Op.lte]: today },
                end_date: { [Op.gte]: today },
            },
            attributes: ["id", "start_date", "end_date", "status"],
            order: [["start_date", "DESC"]],
        }),
        PaymentBatch.count({
            where: {
                generated_at: { [Op.gte]: yearStart, [Op.lt]: nextYearStart },
            },
        }),
        PayPeriod.count({ where: { status: "pending_approval" } }),
    ]);
    const byStatus = batches.reduce((result, batch) => ({ ...result, [batch.status]: (result[batch.status] || 0) + 1 }), {});
    const completedTotal = batches.filter((batch) => batch.status === "completed").reduce((sum, batch) => sum + Number(batch.total_amount), 0);
    return {
        totalBatches: batches.length,
        byStatus,
        completedTotalAmount: completedTotal.toFixed(2),
        summary: {
            activeStaff,
            currentPayPeriod: currentPayPeriod ? {
                id: currentPayPeriod.id,
                startDate: currentPayPeriod.start_date,
                endDate: currentPayPeriod.end_date,
                status: currentPayPeriod.status,
            } : null,
            currentYearBatchCount,
            pendingApprovals,
        },
    };
};

exports.serializeBatch = serializeBatch;
