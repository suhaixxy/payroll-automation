const express = require("express");
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/authController");
const authenticate = require("../middleware/authenticate");
const validateRequest = require("../middleware/validateRequest");
const { loginSchema } = require("../validators/authValidator");

const router = express.Router();
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "TOO_MANY_LOGIN_ATTEMPTS", message: "Too many login attempts. Please try again later.", details: [] },
});

router.post("/login", loginLimiter, validateRequest(loginSchema), authController.login);
router.get("/me", authenticate, authController.me);
router.post("/logout", authenticate, authController.logout);

module.exports = router;
