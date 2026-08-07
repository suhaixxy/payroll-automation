const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { jwtSecret, jwtExpiresIn } = require("../config/auth");
const auditService = require("./auditService");
const AppError = require("../utils/AppError");

const publicUser = (user) => ({
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    staffId: user.staff_id,
});

exports.login = async ({ email, password, ipAddress }) => {
    const user = await User.findOne({ where: { email } });
    const matches = user ? await bcrypt.compare(password, user.password_hash) : false;

    if (!user || !matches) {
        await auditService.record({
            user: user ? publicUser(user) : null,
            action: "LOGIN_FAILURE",
            entityType: "user",
            entityId: user?.id || null,
            ipAddress,
            details: { reason: "invalid_credentials" },
        });
        throw new AppError(401, "INVALID_CREDENTIALS", "The email or password is incorrect.");
    }

    if (user.status !== "active") {
        await auditService.record({
            user: publicUser(user),
            action: "LOGIN_FAILURE",
            entityType: "user",
            entityId: user.id,
            ipAddress,
            details: { reason: "account_disabled" },
        });
        throw new AppError(403, "ACCOUNT_DISABLED", "This account is disabled.");
    }
    if (!jwtSecret) throw new AppError(500, "AUTH_CONFIGURATION_ERROR", "Authentication is not configured.");

    const accessToken = jwt.sign(
        { role: user.role, staffId: user.staff_id || null },
        jwtSecret,
        { subject: user.id, expiresIn: jwtExpiresIn },
    );
    user.last_login_at = new Date();
    await user.save();
    await auditService.record({
        user: publicUser(user),
        action: "LOGIN_SUCCESS",
        entityType: "user",
        entityId: user.id,
        ipAddress,
    });

    return { accessToken, user: publicUser(user) };
};

exports.getCurrentUser = async (authenticatedUser) => authenticatedUser;

exports.logout = async ({ user, ipAddress }) => {
    await auditService.record({
        user,
        action: "LOGOUT",
        entityType: "user",
        entityId: user.id,
        ipAddress,
    });
};
