const AppError = require("../utils/AppError");

const validateRequest = (schema, source = "body") => async (req, res, next) => {
    try {
        req[source] = await schema.validate(req[source], {
            abortEarly: false,
            stripUnknown: true,
        });
        next();
    } catch (error) {
        if (error.name !== "ValidationError") return next(error);
        return next(new AppError(
            400,
            "VALIDATION_ERROR",
            "The request contains invalid data.",
            error.errors,
        ));
    }
};

module.exports = validateRequest;
