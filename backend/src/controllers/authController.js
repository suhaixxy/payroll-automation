const authService = require("../services/authService");

exports.login = async (req, res, next) => {
    try {
        const result = await authService.login({ ...req.body, ipAddress: req.ip });
        res.json(result);
    } catch (error) {
        next(error);
    }
};

exports.me = async (req, res, next) => {
    try {
        res.json({ user: await authService.getCurrentUser(req.user) });
    } catch (error) {
        next(error);
    }
};

exports.logout = async (req, res, next) => {
    try {
        await authService.logout({ user: req.user, ipAddress: req.ip });
        res.json({ message: "Logged out successfully." });
    } catch (error) {
        next(error);
    }
};
