const { Op } = require("sequelize");
const { PayPeriod, PayrollLine, Staff, Approval, PaymentBatch } = require("../models");
const AppError = require("../utils/AppError");
const maskBankAccount = require("../utils/maskBankAccount");

const cents = (value) => Math.round(Number(value) * 100);
const bankCodePattern = /^[A-Za-z0-9-]{3,20}$/;
const bankAccountPattern = /^[A-Za-z0-9-]{5,50}$/;

const classifyBankDetails = (staff) => {
    const missingFields = [];
    if (!staff?.bank_code) missingFields.push("bankCode");
    if (!staff?.bank_account_no) missingFields.push("bankAccountNumber");
    if (missingFields.length) {
        return { status: "missing", missingFields, reason: "Required bank information is missing." };
    }
    if (!bankCodePattern.test(staff.bank_code)) {
        return { status: "invalid", missingFields: [], reason: "Bank code format is invalid." };
    }
    if (!bankAccountPattern.test(staff.bank_account_no)) {
        return { status: "invalid", missingFields: [], reason: "Bank account number format is invalid." };
    }
    return { status: "ready", missingFields: [], reason: null };
};

const assess = async (payPeriodId, transaction = null, { allowBankIssues = false } = {}) => {
    const queryOptions = { transaction };
    if (transaction) queryOptions.lock = transaction.LOCK.UPDATE;
    const payPeriod = await PayPeriod.findByPk(payPeriodId, queryOptions);
    if (!payPeriod) throw new AppError(404, "PAY_PERIOD_NOT_FOUND", "Pay period not found.");
    const existingBatch = await PaymentBatch.findOne({
        where: {
            pay_period_id: payPeriodId,
            status: { [Op.in]: ["generating", "generated", "hrms_sync_pending", "hrms_sync_failed", "completed"] },
        },
        transaction,
    });
    if (existingBatch) {
        throw new AppError(409, "DUPLICATE_PAYMENT_BATCH", "A non-cancelled payment batch already exists for this pay period.", [{ paymentBatchId: existingBatch.id, status: existingBatch.status }]);
    }
    if (payPeriod.status !== "approved") throw new AppError(409, "PERIOD_NOT_APPROVED", "The pay period must be approved before payment generation.");
    if (!payPeriod.is_locked) throw new AppError(409, "PERIOD_NOT_LOCKED", "The approved pay period must be locked before payment generation.");

    const approval = await Approval.findOne({
        where: { pay_period_id: payPeriodId, decision: "approved" },
        order: [["decided_at", "DESC"]],
        transaction,
    });
    if (!approval?.calculation_run_id) throw new AppError(409, "APPROVAL_RECORD_MISSING", "An approval tied to a calculation run is required.");

    const payrollLines = await PayrollLine.findAll({
        where: { run_id: approval.calculation_run_id, period_id: payPeriodId },
        include: [{ model: Staff, as: "staff" }],
        order: [["id", "ASC"]],
        transaction,
    });
    if (payrollLines.length === 0) throw new AppError(409, "PAYROLL_LINES_MISSING", "No payroll lines exist for this pay period.");

    const incomplete = payrollLines.filter((line) => line.line_status !== "complete");
    if (incomplete.length) {
        throw new AppError(409, "INCOMPLETE_PAYROLL_LINE", "Every payroll line must be complete.", incomplete.map((line) => ({ payrollLineId: line.id, status: line.line_status })));
    }

    const bankAssessments = payrollLines.map((line) => ({
        line,
        validation: classifyBankDetails(line.staff),
    }));
    const missingBankDetails = bankAssessments.flatMap(({ line, validation }) =>
        validation.status === "missing" ? [{
            staffId: line.staff_id,
            employeeReference: line.staff?.external_ref || null,
            employeeName: line.staff?.full_name || "Unknown employee",
            missingFields: validation.missingFields,
        }] : []);
    const invalidBankDetails = bankAssessments.flatMap(({ line, validation }) =>
        validation.status === "invalid" ? [{
            staffId: line.staff_id,
            employeeReference: line.staff?.external_ref || null,
            employeeName: line.staff?.full_name || "Unknown employee",
            reason: validation.reason,
        }] : []);
    if (!allowBankIssues && missingBankDetails.length) {
        throw new AppError(424, "MISSING_BANK_DETAILS", "Payment generation is blocked by missing employee bank details.", missingBankDetails);
    }
    if (!allowBankIssues && invalidBankDetails.length) {
        throw new AppError(424, "INVALID_BANK_DETAILS", "Payment generation is blocked by invalid employee bank details.", invalidBankDetails);
    }

    const invalidNetPay = payrollLines.filter((line) => cents(line.net_pay) <= 0);
    if (invalidNetPay.length) {
        throw new AppError(409, "INVALID_NET_PAY", "Every approved net-pay amount must be greater than zero.", invalidNetPay.map((line) => ({ payrollLineId: line.id })));
    }

    const totalCents = payrollLines.reduce((sum, line) => sum + cents(line.net_pay), 0);
    return { payPeriod, approval, calculationRunId: approval.calculation_run_id, payrollLines, bankAssessments, totalAmount: (totalCents / 100).toFixed(2) };
};

exports.assess = assess;

exports.listEligiblePeriods = async () => {
    const periods = await PayPeriod.findAll({
        where: { status: "approved", is_locked: true },
        attributes: ["id", "start_date", "end_date", "status", "is_locked"],
        order: [["start_date", "DESC"]],
    });
    const periodIds = periods.map((period) => period.id);
    const activeBatches = periodIds.length ? await PaymentBatch.findAll({
        where: {
            pay_period_id: periodIds,
            status: { [Op.ne]: "cancelled" },
        },
        attributes: ["pay_period_id"],
    }) : [];
    const activePeriodIds = new Set(activeBatches.map((batch) => batch.pay_period_id));
    return periods.map((period) => ({
        id: period.id,
        startDate: period.start_date,
        endDate: period.end_date,
        status: period.status,
        isLocked: period.is_locked,
        hasActivePaymentBatch: activePeriodIds.has(period.id),
    }));
};

exports.preview = async (payPeriodId) => {
    const result = await assess(payPeriodId, null, { allowBankIssues: true });
    return {
        ready: result.bankAssessments.every(({ validation }) => validation.status === "ready"),
        payPeriod: {
            id: result.payPeriod.id,
            startDate: result.payPeriod.start_date,
            endDate: result.payPeriod.end_date,
            status: result.payPeriod.status,
            isLocked: result.payPeriod.is_locked,
        },
        employeeCount: result.payrollLines.length,
        totalAmount: result.totalAmount,
        employees: result.bankAssessments.map(({ line, validation }) => ({
            staffId: line.staff_id,
            employeeReference: line.staff.external_ref,
            employeeName: line.staff.full_name,
            bankCode: line.staff.bank_code,
            bankAccountNumber: maskBankAccount(line.staff.bank_account_no),
            grossPay: (Number(line.gross_total) - Number(line.incentive_amount)).toFixed(2),
            incentivePay: Number(line.incentive_amount).toFixed(2),
            cpfAmount: Number(line.cpf_employee).toFixed(2),
            sdlAmount: Number(line.sdl).toFixed(2),
            approvedNetPay: Number(line.net_pay).toFixed(2),
            bankValidationStatus: validation.status,
            bankValidationReason: validation.reason,
            missingFields: validation.missingFields,
        })),
    };
};
