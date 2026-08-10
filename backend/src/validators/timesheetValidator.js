const yup = require("yup");

const databaseUuid = () => yup
  .string()
  .trim()
  .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Must be a valid database UUID");

exports.payPeriodParamsSchema = yup.object({
  payPeriodId: databaseUuid().required(),
}).noUnknown(true);

exports.exceptionParamsSchema = yup.object({
  exceptionId: databaseUuid().required(),
}).noUnknown(true);

exports.resolveSchema = yup.object({
  resolution: yup.string().oneOf(["corrected", "noted", "returned"]).required(),
  correctedHours: yup.number().min(0).max(24).nullable().optional(),
  note: yup.string().trim().max(1000).nullable().optional(),
}).noUnknown(true);

exports.bulkResolveSchema = yup.object({
  ruleType: yup.string().oneOf(["overlap", "exceeds_cap", "missing_entry", "public_holiday"]).required(),
  note: yup.string().trim().max(1000).nullable().optional(),
}).noUnknown(true);
