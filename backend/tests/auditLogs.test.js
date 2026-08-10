const request = require("supertest");
const app = require("../src/app");
const { sequelize } = require("../src/models");

const login = async (email, password) => {
    const response = await request(app).post("/api/auth/login").send({ email, password });
    return response.body.accessToken;
};

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

describe("Audit log API", () => {
    let managerToken;
    let auditId;

    beforeAll(async () => {
        managerToken = await login("manager@payroll.local", "Manager123!");
    });

    test("manager can list audit logs with deterministic limit pagination", async () => {
        const response = await request(app)
            .get("/api/audit-logs?limit=1&offset=0")
            .set(bearer(managerToken));
        expect(response.status).toBe(200);
        expect(response.body.count).toBeGreaterThan(0);
        expect(response.body.rows).toHaveLength(1);
        auditId = response.body.rows[0].id;
    });

    test("manager can retrieve one audit event", async () => {
        if (!auditId) {
            const listed = await request(app).get("/api/audit-logs?limit=1").set(bearer(managerToken));
            auditId = listed.body.rows[0].id;
        }
        const response = await request(app).get(`/api/audit-logs/${auditId}`).set(bearer(managerToken));
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(auditId);
        expect(response.body.action).toEqual(expect.any(String));
    });

    test("invalid audit UUID returns VALIDATION_ERROR", async () => {
        const response = await request(app).get("/api/audit-logs/not-a-uuid").set(bearer(managerToken));
        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    test("nonexistent audit event returns AUDIT_LOG_NOT_FOUND", async () => {
        const response = await request(app)
            .get("/api/audit-logs/00000000-0000-4000-8000-000000009999")
            .set(bearer(managerToken));
        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe("AUDIT_LOG_NOT_FOUND");
    });

    test("employee is forbidden from audit logs", async () => {
        const employeeToken = await login("employee@payroll.local", "Employee123!");
        const response = await request(app).get("/api/audit-logs").set(bearer(employeeToken));
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe("FORBIDDEN");
    });

    test("unauthenticated audit request requires authentication", async () => {
        const response = await request(app).get("/api/audit-logs");
        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });
});

afterAll(async () => sequelize.close());
