const request = require("supertest");
const app = require("../src/app");
const { sequelize, AuditLog } = require("../src/models");

describe("Authentication API", () => {
    test("successful login returns a JWT and safe user profile", async () => {
        const response = await request(app).post("/api/auth/login").send({
            email: "manager@payroll.local",
            password: "Manager123!",
        });

        expect(response.status).toBe(200);
        expect(response.body.accessToken).toEqual(expect.any(String));
        expect(response.body.user.role).toBe("manager");
        expect(response.body.user.password_hash).toBeUndefined();
        const audit = await AuditLog.findOne({ where: { action: "LOGIN_SUCCESS", user_id: response.body.user.id } });
        expect(audit).not.toBeNull();
    });

    test("wrong password returns a generic credentials error", async () => {
        const response = await request(app).post("/api/auth/login").send({
            email: "manager@payroll.local",
            password: "WrongPassword123!",
        });
        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
        expect(response.body.error.message).toBe("The email or password is incorrect.");
        expect(response.body.error.message).not.toMatch(/email exists|password only/i);
    });

    test("unknown email returns the same generic credentials error", async () => {
        const response = await request(app).post("/api/auth/login").send({
            email: "unknown@payroll.local",
            password: "WrongPassword123!",
        });
        expect(response.status).toBe(401);
        expect(response.body.error).toMatchObject({
            code: "INVALID_CREDENTIALS",
            message: "The email or password is incorrect.",
        });
    });

    test("disabled user cannot log in", async () => {
        const response = await request(app).post("/api/auth/login").send({
            email: "disabled@payroll.local",
            password: "Disabled123!",
        });
        expect(response.status).toBe(403);
        expect(response.body.error).toMatchObject({
            code: "ACCOUNT_DISABLED",
            message: "This account is disabled.",
        });
    });

    test("missing token cannot access current user", async () => {
        const response = await request(app).get("/api/auth/me");
        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    test("invalid token cannot access current user", async () => {
        const response = await request(app)
            .get("/api/auth/me")
            .set("Authorization", "Bearer invalid-token");
        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe("INVALID_TOKEN");
    });

    test("authenticated user can load profile and log out", async () => {
        const login = await request(app).post("/api/auth/login").send({
            email: "manager@payroll.local",
            password: "Manager123!",
        });
        const token = login.body.accessToken;
        const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
        expect(me.status).toBe(200);
        expect(me.body.user.email).toBe("manager@payroll.local");
        const logout = await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${token}`);
        expect(logout.status).toBe(200);
        expect(await AuditLog.findOne({ where: { action: "LOGOUT", user_id: me.body.user.id } })).not.toBeNull();
    });
});

afterAll(async () => sequelize.close());
