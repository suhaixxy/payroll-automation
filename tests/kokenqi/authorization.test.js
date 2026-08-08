const request = require("supertest");
const app = require("../../backend/src/app");
const { sequelize } = require("../../backend/src/models");

const login = async (email, password) => {
    const response = await request(app).post("/api/auth/login").send({ email, password });
    return response.body.accessToken;
};

describe("Role authorization", () => {
    test("employee cannot access payroll administration routes", async () => {
        const token = await login("employee@payroll.local", "Employee123!");
        const response = await request(app)
            .post("/api/payments/generate")
            .set("Authorization", `Bearer ${token}`)
            .send({ payPeriodId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" });
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe("FORBIDDEN");
    });

    test("manager passes role middleware on a payment route", async () => {
        const token = await login("manager@payroll.local", "Manager123!");
        const response = await request(app)
            .get("/api/payments/00000000-0000-0000-0000-000000000000/file")
            .set("Authorization", `Bearer ${token}`);
        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe("PAYMENT_BATCH_NOT_FOUND");
    });
});

afterAll(async () => sequelize.close());
