const request = require("supertest");
const app = require("../src/app");
const {
    sequelize, PayPeriod, PayrollLine, Approval, PaymentBatch,
    PaymentBatchItem, Payslip, AuditLog,
} = require("../src/models");

const EMPLOYEE_STAFF_ID = "11111111-1111-1111-1111-111111111111";
const ids = {
    period: "93000000-0000-4000-8000-000000000001",
    line: "93000000-0000-4000-8000-000000000002",
    approval: "93000000-0000-4000-8000-000000000003",
};
let managerToken;
let employeeToken;
let batchId;
let payslipId;

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
    await Payslip.destroy({ where: { payroll_line_id: ids.line }, force: true });
    const oldBatches = await PaymentBatch.findAll({ where: { pay_period_id: ids.period }, attributes: ["id"] });
    const oldBatchIds = oldBatches.map((batch) => batch.id);
    if (oldBatchIds.length) await PaymentBatchItem.destroy({ where: { payment_batch_id: oldBatchIds }, force: true });
    await PaymentBatch.destroy({ where: { pay_period_id: ids.period }, force: true });
    await Approval.destroy({ where: { pay_period_id: ids.period }, force: true });
    await PayrollLine.destroy({ where: { pay_period_id: ids.period }, force: true });
    await PayPeriod.destroy({ where: { id: ids.period }, force: true });

    await PayPeriod.create({
        id: ids.period, start_date: "2026-09-01", end_date: "2026-09-15",
        status: "approved", is_locked: true, locked_at: new Date(),
        total_gross: 1500, total_net: 1325,
    });
    await PayrollLine.create({
        id: ids.line, pay_period_id: ids.period, staff_id: EMPLOYEE_STAFF_ID,
        gross_pay: 1500, incentive_pay: 75, cpf_amount: 200,
        sdl_amount: 10, net_pay: 1325, status: "ok",
    });
    await Approval.create({ id: ids.approval, pay_period_id: ids.period, decision: "approved", approved_by: "Payslip Test Manager" });

    const managerLogin = await request(app).post("/api/auth/login").send({ email: "manager@payroll.local", password: "Manager123!" });
    const employeeLogin = await request(app).post("/api/auth/login").send({ email: "employee@payroll.local", password: "Employee123!" });
    managerToken = managerLogin.body.accessToken;
    employeeToken = employeeLogin.body.accessToken;
    const generated = await request(app).post("/api/payments/generate").set(bearer(managerToken)).send({ payPeriodId: ids.period });
    batchId = generated.body.data.id;
    const payslip = await Payslip.findOne({ where: { payment_batch_id: batchId } });
    payslipId = payslip.id;
});

afterAll(async () => {
    await Payslip.destroy({ where: { payment_batch_id: batchId }, force: true });
    await PaymentBatchItem.destroy({ where: { payment_batch_id: batchId }, force: true });
    await PaymentBatch.destroy({ where: { id: batchId }, force: true });
    await Approval.destroy({ where: { pay_period_id: ids.period }, force: true });
    await PayrollLine.destroy({ where: { pay_period_id: ids.period }, force: true });
    await PayPeriod.destroy({ where: { id: ids.period }, force: true });
    await sequelize.close();
});

describe("Automatic payslip generation", () => {
    test("successful payment creates one immutable payslip per payroll line", async () => {
        const payslips = await Payslip.findAll({ where: { payment_batch_id: batchId } });
        expect(payslips).toHaveLength(1);
        expect(payslips[0].payroll_line_id).toBe(ids.line);
        expect(Number(payslips[0].gross_pay)).toBe(1500);
        expect(Number(payslips[0].cpf_amount)).toBe(200);
        expect(Number(payslips[0].sdl_amount)).toBe(10);
        expect(Number(payslips[0].net_pay)).toBe(1325);
        expect(await AuditLog.findOne({ where: { action: "PAYSLIP_GENERATION", entity_id: payslips[0].id } })).not.toBeNull();
    });

    test("manager can list all payslips in a payment batch", async () => {
        const response = await request(app).get(`/api/payments/${batchId}/payslips`).set(bearer(managerToken));
        expect(response.status).toBe(200);
        expect(response.body.rows).toHaveLength(1);
        expect(response.body.rows[0].employeeReference).toBe("EMP001");
    });

    test("manager can list backend-driven payslips with status and payment metadata", async () => {
        const response = await request(app).get("/api/payslips").set(bearer(managerToken));
        expect(response.status).toBe(200);
        const payslip = response.body.rows.find((row) => row.id === payslipId);
        expect(payslip).toMatchObject({
            employeeReference: "EMP001",
            status: "completed",
            paymentMethod: "GIRO",
            currency: "SGD",
        });
        expect(payslip.bankAccountNumber).toMatch(/^XXXX/);
        expect(payslip.earnings).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: "gross_pay", amount: "1500.00" }),
        ]));
        expect(payslip.deductions).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: "cpf", amount: "200.00" }),
        ]));
    });

    test("employee cannot use the manager payslip list", async () => {
        const response = await request(app).get("/api/payslips").set(bearer(employeeToken));
        expect(response.status).toBe(403);
    });
});

describe("Payslip ownership and protected PDF", () => {
    test("employee can view their own payslip", async () => {
        const response = await request(app).get(`/api/payslips/${payslipId}`).set(bearer(employeeToken));
        expect(response.status).toBe(200);
        expect(response.body.staffId).toBe(EMPLOYEE_STAFF_ID);
    });

    test("employee sees only their own payslips", async () => {
        const response = await request(app).get("/api/payslips/me").set(bearer(employeeToken));
        expect(response.status).toBe(200);
        expect(response.body.rows.some((payslip) => payslip.id === payslipId)).toBe(true);
        expect(response.body.rows.every((payslip) => payslip.staffId === EMPLOYEE_STAFF_ID)).toBe(true);
    });

    test("employee cannot view another employee's payslip", async () => {
        const other = await Payslip.create({
            payment_batch_id: batchId,
            payroll_line_id: "55555555-5555-5555-5555-555555555555",
            staff_id: "22222222-2222-2222-2222-222222222222",
            payslip_reference: `PS-OTHER-${Date.now()}`,
            company_name: "Payroll Automation Demo", employee_reference: "EMP002", employee_name: "Nurul Aisyah",
            pay_period_start: "2026-09-01", pay_period_end: "2026-09-15",
            gross_pay: 1800, incentive_pay: 200, cpf_amount: 180, sdl_amount: 15,
            other_deduction: 0, net_pay: 1805, batch_reference: "TEST-BATCH", generated_at: new Date(),
        });
        const response = await request(app).get(`/api/payslips/${other.id}`).set(bearer(employeeToken));
        expect(response.status).toBe(403);
        expect(response.body.error).toBe("PAYSLIP_ACCESS_DENIED");
        await other.destroy({ force: true });
    });

    test("manager can view any payslip", async () => {
        const response = await request(app).get(`/api/payslips/${payslipId}`).set(bearer(managerToken));
        expect(response.status).toBe(200);
        expect(response.body.totalEarnings).toBe("1575.00");
        expect(response.body.totalDeductions).toBe("210.00");
        expect(response.body.bankAccountNumber).toMatch(/^XXXX/);
        expect(response.body).not.toHaveProperty("department");
        expect(response.body).not.toHaveProperty("designation");
        expect(response.body).not.toHaveProperty("paymentDate");
    });

    test("PDF download is protected, valid, and audit logged", async () => {
        const unauthenticated = await request(app).get(`/api/payslips/${payslipId}/pdf`);
        expect(unauthenticated.status).toBe(401);
        const response = await request(app).get(`/api/payslips/${payslipId}/pdf`).set(bearer(employeeToken)).buffer(true).parse((res, callback) => {
            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => callback(null, Buffer.concat(chunks)));
        });
        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toMatch(/application\/pdf/);
        expect(response.body.subarray(0, 4).toString()).toBe("%PDF");
        const pdfText = response.body.toString("latin1");
        const decodedPdfText = [...pdfText.matchAll(/<([0-9a-f]+)>/gi)]
            .map((match) => Buffer.from(match[1], "hex").toString("latin1"))
            .join("");
        expect(decodedPdfText).toContain("EFAR");
        expect(decodedPdfText).toContain("Payroll Automation System");
        expect(decodedPdfText).toContain("Total Earnings");
        expect(decodedPdfText).toContain("Total Deductions");
        expect(decodedPdfText).toContain("Net Pay");
        expect(decodedPdfText).not.toContain("Payroll Automation Demo");
        expect(decodedPdfText).not.toContain("123456789");
        expect(await AuditLog.findOne({ where: { action: "PAYSLIP_DOWNLOAD", entity_id: payslipId } })).not.toBeNull();
    });
});
