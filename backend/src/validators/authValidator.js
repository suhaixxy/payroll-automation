const yup = require("yup");

const loginSchema = yup.object({
    email: yup.string().trim().lowercase().email().max(255).required(),
    password: yup.string().min(8).max(100).required(),
}).noUnknown(true);

module.exports = { loginSchema };
