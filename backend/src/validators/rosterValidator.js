const yup = require("yup");

const databaseUuid = yup.string().trim().matches(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  "Must be a valid database UUID"
);

exports.payPeriodBodySchema = yup.object({
  payPeriodId: databaseUuid.required(),
  simulateFailure: yup.boolean().optional(),
}).noUnknown(true);

exports.payPeriodQuerySchema = yup.object({
  payPeriodId: databaseUuid.required(),
}).noUnknown(true);

exports.timesheetRowParamsSchema = yup.object({
  timesheetRowId: databaseUuid.required(),
}).noUnknown(true);
