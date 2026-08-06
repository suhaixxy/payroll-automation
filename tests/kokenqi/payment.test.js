const request = require("supertest");
const crypto = require("crypto");
const app = require("../../backend/src/app");
const {
    sequelize, PayPeriod, Staff, PayrollLine, Approval,
    PaymentBatch, PaymentBatchItem, Payslip, AuditLog, User,
} = require("../../backend/src/models");

let managerToken;
let managerId;
let managerFullName;
let counter = 100;
const testPeriodIds = [];
const testStaffIds = [];
const testBatchIds = [];

const nextUuid = () => {
    counter += 1;
    return `92000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
};

const auth = (method, url) => request(app)[method](url).set("Authorization", `Bearer ${managerToken}`);

const fixture = async ({
    status = "approved", locked = true, approval = true, lines = true,
    lineStatus = "ok", bank = true, netPay = 942.35,
} = {}) => {
    const payPeriodId = nextUuid();
    testPeriodIds.push(payPeriodId);
    await PayPeriod.create({
        id: payPeriodId, start_date: "2026-08-01", end_date: "2026-08-15",
        status, is_locked: locked, locked_at: locked ? new Date() : null,
        total_gross: 1000, total_net: netPay,
    });
    let staff;
    let payrollLine;
    if (lines) {
        const staffId = nextUuid();
        testStaffIds.push(staffId);
        staff = await Staff.create({
            id: staffId, external_ref: `T${counter}`, full_name: `Test Employee ${counter}`,
            employment_type: "part_time", bank_code: bank ? "7171" : null,
            bank_account_no: bank ? `12345${counter}` : null,
        });
        payrollLine = await PayrollLine.create({
            id: nextUuid(), pay_period_id: payPeriodId, staff_id: staff.id,
            gross_pay: 1000, incentive_pay: 50, cpf_amount: 100, sdl_amount: 7.65,
            net_pay: netPay, status: lineStatus,
        });
    }
    if (approval) {
        await Approval.create({ id: nextUuid(), pay_period_id: payPeriodId, decision: "approved", approved_by: "Test Manager" });
    }
    return { payPeriodId, staff, payrollLine };
};

beforeAll(async () => {
    process.env.HRMS_SIMULATE_FAILURE = "false";
    const response = await request(app).post("/api/auth/login").send({ email: "manager@payroll.local", password: "Manager123!" });
    managerToken = response.body.accessToken;
    const manager = await User.findOne({ where: { email: "manager@payroll.local" } });
    managerId = manager.id;
    managerFullName = manager.full_name;
});

afterAll(async () => {
    process.env.HRMS_SIMULATE_FAILURE = "false";
    const batches = await PaymentBatch.findAll({ where: { pay_period_id: testPeriodIds }, attributes: ["id"] });
    const batchIds = batches.map((batch) => batch.id).concat(testBatchIds);
    if (batchIds.length) await Payslip.destroy({ where: { payment_batch_id: batchIds }, force: true });
    if (batchIds.length) await PaymentBatchItem.destroy({ where: { payment_batch_id: batchIds }, force: true });
    if (testBatchIds.length) await PaymentBatch.destroy({ where: { id: testBatchIds }, force: true });
    await PaymentBatch.destroy({ where: { pay_period_id: testPeriodIds }, force: true });
    await Approval.destroy({ where: { pay_period_id: testPeriodIds }, force: true });
    await PayrollLine.destroy({ where: { pay_period_id: testPeriodIds }, force: true });
    await PayPeriod.destroy({ where: { id: testPeriodIds }, force: true });
    await Staff.destroy({ where: { id: testStaffIds }, force: true });
    await sequelize.close();
});

describe("Payment readiness", () => {
    test("manager sees only approved and locked eligible periods with active-batch indicator", async () => {
        const eligible = await fixture();
        const unlocked = await fixture({ locked: false });
        const pending = await fixture({ status: "pending_approval" });
        const response = await auth("get", "/api/payments/eligible-periods");
        expect(response.status).toBe(200);
        expect(response.body.rows.some((period) => period.id === eligible.payPeriodId && period.hasActivePaymentBatch === false)).toBe(true);
        expect(response.body.rows.some((period) => period.id === unlocked.payPeriodId)).toBe(false);
        expect(response.body.rows.some((period) => period.id === pending.payPeriodId)).toBe(false);

        process.env.HRMS_SIMULATE_FAILURE = "true";
        await auth("post", "/api/payments/generate").send({ payPeriodId: eligible.payPeriodId });
        process.env.HRMS_SIMULATE_FAILURE = "false";
        const refreshed = await auth("get", "/api/payments/eligible-periods");
        expect(refreshed.body.rows.find((period) => period.id === eligible.payPeriodId).hasActivePaymentBatch).toBe(true);
    });

    test("eligible period endpoint requires authentication and manager role", async () => {
        expect((await request(app).get("/api/payments/eligible-periods")).status).toBe(401);
        const employeeLogin = await request(app).post("/api/auth/login").send({ email: "employee@payroll.local", password: "Employee123!" });
        const response = await request(app).get("/api/payments/eligible-periods").set("Authorization", `Bearer ${employeeLogin.body.accessToken}`);
        expect(response.status).toBe(403);
    });

    test("approved and locked payroll is ready", async () => {
        const data = await fixture();
        const response = await auth("get", `/api/payments/preview?payPeriodId=${data.payPeriodId}`);
        expect(response.status).toBe(200);
        expect(response.body.ready).toBe(true);
        expect(response.body.employees[0].bankAccountNumber).toMatch(/^XXXX/);
        expect(response.body.employees[0]).toMatchObject({
            grossPay: "1000.00",
            cpfAmount: "100.00",
            sdlAmount: "7.65",
            bankValidationStatus: "ready",
        });
    });

    test.each([
        ["unapproved payroll", { status: "pending_approval" }, "PERIOD_NOT_APPROVED"],
        ["unlocked payroll", { locked: false }, "PERIOD_NOT_LOCKED"],
        ["missing approval", { approval: false }, "APPROVAL_RECORD_MISSING"],
        ["missing payroll lines", { lines: false }, "PAYROLL_LINES_MISSING"],
        ["incomplete payroll line", { lineStatus: "incomplete" }, "INCOMPLETE_PAYROLL_LINE"],
        ["invalid net pay", { netPay: 0 }, "INVALID_NET_PAY"],
    ])("rejects %s", async (name, options, code) => {
        const data = await fixture(options);
        const response = await auth("get", `/api/payments/preview?payPeriodId=${data.payPeriodId}`);
        expect(response.status).toBe(409);
        expect(response.body.error).toBe(code);
    });

    test("missing bank details block generation and create no partial batch", async () => {
        const data = await fixture({ bank: false });
        const preview = await auth("get", `/api/payments/preview?payPeriodId=${data.payPeriodId}`);
        expect(preview.status).toBe(200);
        expect(preview.body.employees[0]).toMatchObject({
            bankValidationStatus: "missing",
            grossPay: "1000.00",
            approvedNetPay: "942.35",
        });
        expect(preview.body.employees[0].missingFields).toEqual(expect.arrayContaining(["bankCode", "bankAccountNumber"]));
        const response = await auth("post", "/api/payments/generate").send({ payPeriodId: data.payPeriodId });
        expect(response.status).toBe(424);
        expect(response.body.error).toBe("MISSING_BANK_DETAILS");
        expect(response.body.details[0].missingFields).toEqual(expect.arrayContaining(["bankCode", "bankAccountNumber"]));
        expect(await PaymentBatch.count({ where: { pay_period_id: data.payPeriodId } })).toBe(0);
    });
});

describe("Payment generation and secured CSV", () => {
    test("approved values are snapshotted unchanged and totals match", async () => {
        const data = await fixture({ netPay: 942.35 });
        const response = await auth("post", "/api/payments/generate").send({ payPeriodId: data.payPeriodId });
        expect(response.status).toBe(201);
        expect(response.body.data.status).toBe("completed");
        expect(response.body.data.hrmsSyncStatus).toBe("completed");
        expect(response.body.data.totalAmount).toBe("942.35");
        expect(response.body.data.payPeriod).toEqual({
            id: data.payPeriodId,
            startDate: "2026-08-01",
            endDate: "2026-08-15",
            status: "payment_ready",
        });
        expect(response.body.data.generatedBy).toEqual({
            id: managerId,
            fullName: managerFullName,
        });
        const item = await PaymentBatchItem.findOne({ where: { payment_batch_id: response.body.data.id } });
        expect(Number(item.net_pay)).toBe(942.35);
        expect(Number(item.cpf_amount)).toBe(100);
        expect(Number(item.sdl_amount)).toBe(7.65);
        const period = await PayPeriod.findByPk(data.payPeriodId);
        expect(period.status).toBe("payment_ready");
    });

    test("duplicate payment is prevented", async () => {
        const data = await fixture();
        await auth("post", "/api/payments/generate").send({ payPeriodId: data.payPeriodId });
        const duplicate = await auth("post", "/api/payments/generate").send({ payPeriodId: data.payPeriodId });
        expect(duplicate.status).toBe(409);
        expect(duplicate.body.error).toBe("DUPLICATE_PAYMENT_BATCH");
    });

    test("CSV contains correct headers and approved value and creates audit log", async () => {
        const data = await fixture({ netPay: 812.34 });
        const generated = await auth("post", "/api/payments/generate").send({ payPeriodId: data.payPeriodId });
        const response = await auth("get", `/api/payments/${generated.body.data.id}/file`);
        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toMatch(/text\/csv/);
        expect(response.headers["content-disposition"]).toMatch(/attachment; filename="Payroll_PAY-/);
        expect(response.text).toContain("Batch Reference,Employee Reference,Employee Name,Bank Code,Bank Account Number,Approved Net Pay Amount,Payment Reference");
        expect(response.text).toContain("812.34");
        const details = await auth("get", `/api/payments/${generated.body.data.id}`);
        expect(details.body.paymentFile.sizeBytes).toBe(Buffer.byteLength(response.text, "utf8"));
        expect(details.body.paymentFile.checksumSha256).toBe(
            crypto.createHash("sha256").update(response.text, "utf8").digest("hex")
        );
        expect(await AuditLog.findOne({ where: { action: "PAYMENT_FILE_DOWNLOAD", entity_id: generated.body.data.id } })).not.toBeNull();
    });

    test("employee cannot download payment files", async () => {
        const employeeLogin = await request(app).post("/api/auth/login").send({ email: "employee@payroll.local", password: "Employee123!" });
        const response = await request(app).get(`/api/payments/${nextUuid()}/file`).set("Authorization", `Bearer ${employeeLogin.body.accessToken}`);
        expect(response.status).toBe(403);
    });

    test("batch details mask bank account numbers", async () => {
        const data = await fixture();
        const generated = await auth("post", "/api/payments/generate").send({ payPeriodId: data.payPeriodId });
        const response = await auth("get", `/api/payments/${generated.body.data.id}`);
        expect(response.status).toBe(200);
        expect(response.body.items[0].bankAccountNumber).toMatch(/^XXXX/);
        expect(response.body.items[0].bankAccountNumber).not.toBe(data.staff.bank_account_no);
    });

    test("history search and dashboard statistics return generated batches", async () => {
        const data = await fixture();
        const generated = await auth("post", "/api/payments/generate").send({ payPeriodId: data.payPeriodId });
        const reference = generated.body.data.batchReference;
        const history = await auth("get", `/api/payments?search=${encodeURIComponent(reference)}&status=completed`);
        expect(history.status).toBe(200);
        expect(history.body.rows.some((batch) => batch.batchReference === reference)).toBe(true);
        const statistics = await auth("get", "/api/payments/dashboard/statistics");
        expect(statistics.status).toBe(200);
        expect(statistics.body.byStatus.completed).toBeGreaterThan(0);
    });

    test("dashboard statistics detect a pay period covering today using inclusive date boundaries", async () => {
        // The real wall-clock date can coincide with the seed's permanent "LARGE GENERATION
        // TEST PERIOD" (2026-08-01 to 2026-08-15) and with every other test's fixture()-created
        // period in this file (same hardcoded range), making "today" an ambiguous, test-order-
        // and calendar-dependent value to assert against. Freezing Date alone (timers/
        // microtasks stay real so the async supertest request still completes normally) to a
        // date with no pay_period coverage at all removes the ambiguity entirely: this test's
        // own period is the only candidate the endpoint can return, independent of the real
        // calendar date, seed data, or any other fixture's ordering. Freezing backward (rather
        // than forward) also keeps the already-issued manager JWT valid, since jwt.verify here
        // only rejects an expired `exp`, never an `iat`/`nbf` that looks "in the future".
        jest.useFakeTimers({
            doNotFake: [
                "setTimeout", "clearTimeout", "setInterval", "clearInterval",
                "setImmediate", "clearImmediate", "nextTick", "hrtime",
                "performance", "queueMicrotask",
            ],
        });
        jest.setSystemTime(new Date("2020-01-01T04:00:00.000Z"));
        try {
            const today = new Date().toISOString().slice(0, 10);
            const periodId = nextUuid();
            testPeriodIds.push(periodId);
            await PayPeriod.create({
                id: periodId, start_date: today, end_date: today,
                status: "pending_approval", is_locked: false,
            });
            const statistics = await auth("get", "/api/payments/dashboard/statistics");
            expect(statistics.status).toBe(200);
            expect(statistics.body.summary.currentPayPeriod).toMatchObject({ id: periodId, startDate: today, endDate: today });
        } finally {
            jest.useRealTimers();
        }
    });
});

describe("Payment file download", () => {
    test("valid batch downloads successfully", async () => {
        const data = await fixture({ netPay: 500.5 });
        const generated = await auth("post", "/api/payments/generate").send({ payPeriodId: data.payPeriodId });
        const response = await auth("get", `/api/payments/${generated.body.data.id}/file`);
        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toMatch(/text\/csv/);
        expect(response.headers["content-disposition"]).toMatch(/attachment; filename="Payroll_PAY-/);
    });

    test("batch with zero payment items returns 409", async () => {
        const data = await fixture({ lines: false, approval: false });
        const batch = await PaymentBatch.create({
            id: nextUuid(),
            pay_period_id: data.payPeriodId,
            batch_reference: `PAY-TEST-${counter}`,
            file_format: "giro",
            employee_count: 0,
            total_amount: 0,
            status: "generated",
            hrms_sync_status: "not_started",
            generated_by: managerId,
            generated_at: new Date(),
        });
        testBatchIds.push(batch.id);
        const response = await auth("get", `/api/payments/${batch.id}/file`);
        expect(response.status).toBe(409);
        expect(response.body.error).toBe("PAYMENT_FILE_EMPTY");
    });

    test("nonexistent batch returns 404", async () => {
        const response = await auth("get", `/api/payments/${nextUuid()}/file`);
        expect(response.status).toBe(404);
        expect(response.body.error).toBe("PAYMENT_BATCH_NOT_FOUND");
    });

    test("unauthenticated download is rejected with 401", async () => {
        const data = await fixture({ netPay: 500.5 });
        const generated = await auth("post", "/api/payments/generate").send({ payPeriodId: data.payPeriodId });
        const response = await request(app).get(`/api/payments/${generated.body.data.id}/file`);
        expect(response.status).toBe(401);
    });

    test("employee download is forbidden with 403", async () => {
        const data = await fixture({ netPay: 500.5 });
        const generated = await auth("post", "/api/payments/generate").send({ payPeriodId: data.payPeriodId });
        const employeeLogin = await request(app).post("/api/auth/login").send({ email: "employee@payroll.local", password: "Employee123!" });
        const response = await request(app)
            .get(`/api/payments/${generated.body.data.id}/file`)
            .set("Authorization", `Bearer ${employeeLogin.body.accessToken}`);
        expect(response.status).toBe(403);
    });
});

describe("HRMS failure, retry, and cancellation", () => {
    test("HRMS failure retains the batch and retry succeeds without regeneration", async () => {
        const data = await fixture();
        process.env.HRMS_SIMULATE_FAILURE = "true";
        const failed = await auth("post", "/api/payments/generate").send({ payPeriodId: data.payPeriodId });
        process.env.HRMS_SIMULATE_FAILURE = "false";
        expect(failed.status).toBe(502);
        const batchId = failed.body.details[0].paymentBatchId;
        const retained = await PaymentBatch.findByPk(batchId);
        expect(retained.status).toBe("hrms_sync_failed");
        expect(await PaymentBatchItem.count({ where: { payment_batch_id: batchId } })).toBe(1);
        expect(await Payslip.count({ where: { payment_batch_id: batchId } })).toBe(0);
        const retried = await auth("post", `/api/payments/${batchId}/retry-hrms`).send({});
        expect(retried.status).toBe(200);
        expect(retried.body.data.status).toBe("completed");
        expect(await PaymentBatch.count({ where: { pay_period_id: data.payPeriodId } })).toBe(1);
        expect(await Payslip.count({ where: { payment_batch_id: batchId } })).toBe(1);
    });

    test("completed batch cannot be cancelled", async () => {
        const data = await fixture();
        const generated = await auth("post", "/api/payments/generate").send({ payPeriodId: data.payPeriodId });
        const response = await auth("patch", `/api/payments/${generated.body.data.id}/cancel`).send({ reason: "Should not be allowed" });
        expect(response.status).toBe(409);
        expect(response.body.error).toBe("INVALID_CANCELLATION");
    });

    test("HRMS-failed batch can be soft-cancelled", async () => {
        const data = await fixture();
        process.env.HRMS_SIMULATE_FAILURE = "true";
        const failed = await auth("post", "/api/payments/generate").send({ payPeriodId: data.payPeriodId });
        process.env.HRMS_SIMULATE_FAILURE = "false";
        const batchId = failed.body.details[0].paymentBatchId;
        const response = await auth("patch", `/api/payments/${batchId}/cancel`).send({ reason: "Manager cancelled failed batch" });
        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe("cancelled");
        expect((await PaymentBatch.findByPk(batchId)).cancelled_at).not.toBeNull();
    });
});

describe("Missing bank management", () => {
    test("manager update returns masked account and creates safe audit", async () => {
        const data = await fixture({ bank: false });
        const response = await auth("patch", `/api/staff/${data.staff.id}/bank-details`).send({ bankCode: "7339", bankAccountNumber: "9988776655" });
        expect(response.status).toBe(200);
        expect(response.body.data.bankAccountNumber).toBe("XXXX6655");
        const audit = await AuditLog.findOne({ where: { action: "BANK_DETAILS_UPDATED", entity_id: data.staff.id } });
        expect(JSON.stringify(audit.details)).not.toContain("9988776655");
    });
});
