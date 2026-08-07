const yup = require("yup");
const databaseUuid = yup.string().trim().matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Must be a valid database UUID");

exports.payslipParamsSchema = yup.object({ payslipId: databaseUuid.required() }).noUnknown(true);
