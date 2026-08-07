const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { jwtSecret } = require("../config/auth");
const AppError = require("../utils/AppError");

module.exports = async (req, res, next) => {
    try {
        const authorization = req.get("Authorization") || "";
        const [scheme, token] = authorization.split(" ");
        if (scheme !== "Bearer" || !token) {
            throw new AppError(401, "AUTHENTICATION_REQUIRED", "A valid access token is required.");
        }
        if (!jwtSecret) {
            throw new AppError(500, "AUTH_CONFIGURATION_ERROR", "Authentication is not configured.");
        }

        let payload;
        try {
            payload = jwt.verify(token, jwtSecret);
        } catch {
            throw new AppError(401, "INVALID_TOKEN", "The access token is invalid or expired.");
        }

        const user = await User.findByPk(payload.sub);
        if (!user || user.status !== "active") {
            throw new AppError(401, "INVALID_TOKEN", "The access token is invalid or expired.");
        }

        req.user = {
            id: user.id,
            fullName: user.full_name,
            email: user.email,
            role: user.role,
            staffId: user.staff_id,
        };
        next();
    } catch (error) {
        next(error);
    }
};
