const PDFDocument = require("pdfkit");
const { Op, col } = require("sequelize");
const { Payslip, PaymentBatch, PaymentBatchItem, PayPeriod, Staff } = require("../models");
const auditService = require("./auditService");
const AppError = require("../utils/AppError");
const maskBankAccount = require("../utils/maskBankAccount");

const money = (value) => new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(Number(value || 0));
const date = (value) => new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));

const serialize = (payslip) => {
    const earnings = [
        { code: "gross_pay", description: "Gross Pay", amount: Number(payslip.gross_pay).toFixed(2) },
        { code: "incentive_pay", description: "Incentive Pay", amount: Number(payslip.incentive_pay).toFixed(2) },
    ].filter((item) => Number(item.amount) !== 0);
    const deductions = [
        { code: "cpf", description: "CPF", amount: Number(payslip.cpf_amount).toFixed(2) },
        { code: "sdl", description: "SDL", amount: Number(payslip.sdl_amount).toFixed(2) },
        { code: "other_deduction", description: "Other Deductions", amount: Number(payslip.other_deduction).toFixed(2) },
    ].filter((item) => Number(item.amount) !== 0);
    return ({
    id: payslip.id,
    paymentBatchId: payslip.payment_batch_id,
    payPeriodId: payslip.paymentBatch?.pay_period_id || null,
    payrollLineId: payslip.payroll_line_id,
    staffId: payslip.staff_id,
    payslipReference: payslip.payslip_reference,
    companyName: payslip.company_name,
    employeeReference: payslip.employee_reference,
    employeeName: payslip.employee_name,
    payPeriodStart: payslip.pay_period_start,
    payPeriodEnd: payslip.pay_period_end,
    grossPay: Number(payslip.gross_pay).toFixed(2),
    incentivePay: Number(payslip.incentive_pay).toFixed(2),
    cpfAmount: Number(payslip.cpf_amount).toFixed(2),
    sdlAmount: Number(payslip.sdl_amount).toFixed(2),
    otherDeduction: Number(payslip.other_deduction).toFixed(2),
    netPay: Number(payslip.net_pay).toFixed(2),
    batchReference: payslip.batch_reference,
    generatedAt: payslip.generated_at,
    status: payslip.paymentBatch?.status || null,
    bank: payslip.paymentItem?.bank_code || null,
    bankAccountNumber: payslip.paymentItem?.bank_account_no
        ? maskBankAccount(payslip.paymentItem.bank_account_no)
        : null,
    paymentMethod: payslip.paymentBatch?.file_format?.toUpperCase() || null,
    currency: "SGD",
    earnings,
    deductions,
    totalEarnings: earnings.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2),
    totalDeductions: deductions.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2),
    });
};

const payslipIncludes = [
    { model: PaymentBatch, as: "paymentBatch", attributes: ["id", "pay_period_id", "status", "file_format"] },
    {
        model: PaymentBatchItem,
        as: "paymentItem",
        attributes: ["bank_code", "bank_account_no"],
        required: false,
        // A payroll line can have PaymentBatchItem rows in more than one batch (e.g. a
        // cancelled-then-regenerated batch), so the join must also match payment_batch_id
        // or Sequelize's hasOne LEFT JOIN fans out and duplicates the parent Payslip row.
        on: {
            payroll_line_id: { [Op.eq]: col("Payslip.payroll_line_id") },
            payment_batch_id: { [Op.eq]: col("Payslip.payment_batch_id") },
        },
    },
    { model: Staff, as: "staff", attributes: ["id", "employment_type"], required: false },
];

const assertAccess = (payslip, user) => {
    if (user.role === "manager") return;
    if (user.role !== "employee" || !user.staffId || user.staffId !== payslip.staff_id) {
        throw new AppError(403, "PAYSLIP_ACCESS_DENIED", "You may access only your own payslips.");
    }
};

exports.generateForBatch = async ({ batchId, transaction }) => {
    const batch = await PaymentBatch.findByPk(batchId, {
        include: [
            { model: PaymentBatchItem, as: "items" },
            { model: PayPeriod, as: "payPeriod" },
        ],
        transaction,
    });
    if (!batch) throw new AppError(404, "PAYMENT_BATCH_NOT_FOUND", "Payment batch not found.");
    if (!batch.payPeriod) throw new AppError(409, "PAY_PERIOD_NOT_FOUND", "The payment batch pay period no longer exists.");

    const companyName = process.env.COMPANY_NAME || "Emergencies First Aid & Rescue";
    const records = batch.items.map((item) => ({
        payment_batch_id: batch.id,
        payroll_line_id: item.payroll_line_id,
        staff_id: item.staff_id,
        payslip_reference: `PS-${batch.batch_reference}-${item.id.slice(0, 8)}`.slice(0, 60),
        company_name: companyName,
        employee_reference: item.employee_reference,
        employee_name: item.employee_name,
        pay_period_start: batch.payPeriod.start_date,
        pay_period_end: batch.payPeriod.end_date,
        gross_pay: item.gross_pay,
        incentive_pay: item.incentive_pay,
        cpf_amount: item.cpf_amount,
        sdl_amount: item.sdl_amount,
        other_deduction: item.other_deduction,
        net_pay: item.net_pay,
        batch_reference: batch.batch_reference,
        generated_at: new Date(),
    }));

    if (records.length) {
        await Payslip.bulkCreate(records, {
            transaction,
            ignoreDuplicates: true,
        });
    }
    return Payslip.findAll({ where: { payment_batch_id: batch.id }, transaction });
};

exports.auditGenerated = async ({ payslips, user, ipAddress }) => Promise.all(payslips.map((payslip) => auditService.record({
    user,
    action: "PAYSLIP_GENERATION",
    entityType: "payslip",
    entityId: payslip.id,
    ipAddress,
    details: { paymentBatchId: payslip.payment_batch_id },
})));

exports.listForBatch = async ({ batchId, user, ipAddress }) => {
    const batch = await PaymentBatch.findByPk(batchId);
    if (!batch) throw new AppError(404, "PAYMENT_BATCH_NOT_FOUND", "Payment batch not found.");
    const payslips = await Payslip.findAll({ where: { payment_batch_id: batchId }, include: payslipIncludes, order: [["employee_name", "ASC"]] });
    await auditService.record({ user, action: "PAYSLIP_VIEW", entityType: "payment_batch", entityId: batchId, ipAddress, details: { payslipCount: payslips.length } });
    return payslips.map(serialize);
};

exports.listAll = async ({ user, ipAddress }) => {
    if (user.role !== "manager") throw new AppError(403, "PAYSLIP_ACCESS_DENIED", "Manager access is required.");
    const payslips = await Payslip.findAll({ include: payslipIncludes, order: [["generated_at", "DESC"], ["employee_name", "ASC"]] });
    await auditService.record({ user, action: "PAYSLIP_VIEW", entityType: "payslip_list", entityId: user.id, ipAddress, details: { payslipCount: payslips.length } });
    return payslips.map(serialize);
};

exports.listMine = async ({ user, ipAddress }) => {
    if (!user.staffId) throw new AppError(403, "PAYSLIP_ACCESS_DENIED", "This employee account is not linked to a staff record.");
    const payslips = await Payslip.findAll({ where: { staff_id: user.staffId }, include: payslipIncludes, order: [["generated_at", "DESC"]] });
    await auditService.record({ user, action: "PAYSLIP_VIEW", entityType: "staff", entityId: user.staffId, ipAddress, details: { ownPayslips: true, payslipCount: payslips.length } });
    return payslips.map(serialize);
};

exports.getById = async ({ payslipId, user, ipAddress, audit = true }) => {
    const payslip = await Payslip.findByPk(payslipId, { include: payslipIncludes });
    if (!payslip) throw new AppError(404, "PAYSLIP_NOT_FOUND", "Payslip not found.");
    assertAccess(payslip, user);
    if (audit) await auditService.record({ user, action: "PAYSLIP_VIEW", entityType: "payslip", entityId: payslip.id, ipAddress });
    return payslip;
};

const createPdf = (payslip) => new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margin: 50, compress: false, info: { Title: `Payslip ${payslip.payslipReference}` } });
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    document.fillColor("#7A0000").font("Helvetica-Bold").fontSize(24).text("EFAR", { align: "center" });
    document.fillColor("#181818").fontSize(11).text("Payroll Automation System", { align: "center" });
    document.moveDown(0.35).fontSize(17).text("Employee Payslip", { align: "center" });
    document.moveDown(1.4).font("Helvetica").fontSize(10);
    document.text(`Payslip Reference: ${payslip.payslipReference}`);
    document.text(`Payment Batch Reference: ${payslip.batchReference}`);
    document.text(`Pay Period: ${date(payslip.payPeriodStart)} - ${date(payslip.payPeriodEnd)}`);
    document.text(`Generated On: ${date(payslip.generatedAt)}`);
    document.moveDown().moveTo(50, document.y).lineTo(545, document.y).stroke().moveDown();
    const row = (label, value, bold = false) => {
        document.font(bold ? "Helvetica-Bold" : "Helvetica").text(label, 60, document.y, { continued: true, width: 330 }).text(value, { align: "right", width: 145 });
    };
    document.font("Helvetica-Bold").fontSize(11).text("Employee Information");
    document.moveDown(0.4);
    row("Employee Name", payslip.employeeName);
    row("Employee ID", payslip.employeeReference);
    document.moveDown();
    document.font("Helvetica-Bold").fontSize(11).text("Payment Information");
    document.moveDown(0.4);
    if (payslip.bank) row("Bank", payslip.bank);
    if (payslip.bankAccountNumber) row("Masked Account Number", payslip.bankAccountNumber);
    if (payslip.paymentMethod) row("Payment Method", payslip.paymentMethod);
    document.moveDown();
    document.font("Helvetica-Bold").fontSize(11).text("Earnings");
    document.moveDown(0.4);
    payslip.earnings.forEach((item) => row(item.description, money(item.amount)));
    row("Total Earnings", money(payslip.totalEarnings), true);
    document.moveDown();
    document.font("Helvetica-Bold").fontSize(11).text("Deductions");
    document.moveDown(0.4);
    payslip.deductions.forEach((item) => row(item.description, money(item.amount)));
    row("Total Deductions", money(payslip.totalDeductions), true);
    document.moveDown(0.6).moveTo(50, document.y).lineTo(545, document.y).stroke().moveDown(0.6);
    row("Net Pay", money(payslip.netPay), true);
    document.moveDown(2).font("Helvetica").fontSize(9).fillColor("#555555").text("This is a computer generated payslip. No signature is required.", { align: "center" });
    document.end();
});

exports.createPdfDownload = async ({ payslipId, user, ipAddress }) => {
    const payslip = await exports.getById({ payslipId, user, ipAddress, audit: false });
    const payslipData = serialize(payslip);
    const content = await createPdf(payslipData);
    await auditService.record({ user, action: "PAYSLIP_DOWNLOAD", entityType: "payslip", entityId: payslip.id, ipAddress });
    return { content, fileName: `${payslipData.payslipReference}.pdf` };
};

exports.serialize = serialize;
