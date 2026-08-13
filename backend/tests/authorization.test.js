const request = require("supertest");
const app = require("../src/app");
const { sequelize } = require("../src/models");

const login = async (email, password) => {
    const response = await request(app).post("/api/auth/login").send({ email, password });
    return response.body.accessToken;
};

describe("Role authorization", () => {
    let employeeToken;
    let managerToken;

    beforeAll(async () => {
        employeeToken = await login("employee@payroll.local", "Employee123!");
        managerToken = await login("manager@payroll.local", "Manager123!");
    });

    test("employee cannot access payroll administration routes", async () => {
        const response = await request(app)
            .post("/api/payments/generate")
            .set("Authorization", `Bearer ${employeeToken}`)
            .send({ payPeriodId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" });
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe("FORBIDDEN");
    });

    test("manager passes role middleware on a payment route", async () => {
        const response = await request(app)
            .get("/api/payments/00000000-0000-0000-0000-000000000000/file")
            .set("Authorization", `Bearer ${managerToken}`);
        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe("PAYMENT_BATCH_NOT_FOUND");
    });

    test.each([
        ["roster", "/api/roster/sync/summary?payPeriodId=a1000000-0000-4000-8000-000000000001"],
        ["backpay", "/api/backpay-reports"],
    ])("anonymous requests cannot access %s operations", async (_name, path) => {
        const response = await request(app).get(path);
        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    test.each([
        ["roster", "/api/roster/sync/summary?payPeriodId=a1000000-0000-4000-8000-000000000001"],
        ["backpay", "/api/backpay-reports"],
    ])("employees cannot access %s operations", async (_name, path) => {
        const response = await request(app).get(path).set("Authorization", `Bearer ${employeeToken}`);
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe("FORBIDDEN");
    });

    test.each([
        ["roster", "/api/roster/sync/summary?payPeriodId=a1000000-0000-4000-8000-000000000001"],
        ["backpay", "/api/backpay-reports"],
    ])("managers can access %s operations", async (_name, path) => {
        const response = await request(app).get(path).set("Authorization", `Bearer ${managerToken}`);
        expect(response.status).toBe(200);
    });
});

afterAll(async () => sequelize.close());
