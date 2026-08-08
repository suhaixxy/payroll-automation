const { pool } = require("../config/database");
const staffBankService = require("../services/staffBankService");
const AppError = require("../utils/AppError");

const STAFF_COLUMNS = `
  id,
  external_ref AS "externalRef",
  full_name AS "fullName",
  employment_type AS "employmentType",
  status
`;

const STAFF_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMPLOYMENT_TYPES = new Set(["full_time", "part_time"]);
const STAFF_STATUSES = new Set(["active", "inactive"]);

const validateStaffId = (id) => {
  if (!STAFF_ID_PATTERN.test(id)) {
    throw new AppError(400, "INVALID_STAFF_ID", "Staff ID must be a valid UUID.");
  }
};

const validateEmploymentType = (employmentType) => {
  if (!EMPLOYMENT_TYPES.has(employmentType)) {
    throw new AppError(400, "INVALID_EMPLOYMENT_TYPE", "Employment type must be full_time or part_time.");
  }
};

exports.list = async (req, res, next) => {
  try {
    const { status } = req.query;
    if (status && status !== "active") {
      throw new AppError(400, "INVALID_STATUS_FILTER", "Status filter must be active.");
    }

    const result = await pool.query(
      `SELECT ${STAFF_COLUMNS} FROM staff${status ? " WHERE status = 'active'" : ""} ORDER BY full_name`,
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    validateStaffId(req.params.id);
    const result = await pool.query(
      `SELECT ${STAFF_COLUMNS} FROM staff WHERE id = $1`,
      [req.params.id],
    );
    if (!result.rows[0]) {
      throw new AppError(404, "STAFF_NOT_FOUND", "Staff member not found.");
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const externalRef = typeof req.body.external_ref === "string" ? req.body.external_ref.trim() : "";
    const fullName = typeof req.body.full_name === "string" ? req.body.full_name.trim() : "";
    const { employment_type: employmentType } = req.body;

    if (!externalRef || !fullName || !employmentType) {
      throw new AppError(400, "VALIDATION_ERROR", "external_ref, full_name, and employment_type are required.");
    }
    validateEmploymentType(employmentType);

    const existing = await pool.query("SELECT 1 FROM staff WHERE external_ref = $1", [externalRef]);
    if (existing.rows[0]) {
      throw new AppError(409, "STAFF_EXTERNAL_REF_EXISTS", "A staff member with this external reference already exists.");
    }

    const result = await pool.query(
      `INSERT INTO staff (external_ref, full_name, employment_type)
       VALUES ($1, $2, $3)
       RETURNING ${STAFF_COLUMNS}`,
      [externalRef, fullName, employmentType],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return next(new AppError(409, "STAFF_EXTERNAL_REF_EXISTS", "A staff member with this external reference already exists."));
    }
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    validateStaffId(req.params.id);
    const updates = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(req.body, "full_name")) {
      const fullName = typeof req.body.full_name === "string" ? req.body.full_name.trim() : "";
      if (!fullName) {
        throw new AppError(400, "VALIDATION_ERROR", "full_name cannot be empty.");
      }
      values.push(fullName);
      updates.push(`full_name = $${values.length}`);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "employment_type")) {
      validateEmploymentType(req.body.employment_type);
      values.push(req.body.employment_type);
      updates.push(`employment_type = $${values.length}`);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
      if (!STAFF_STATUSES.has(req.body.status)) {
        throw new AppError(400, "INVALID_STAFF_STATUS", "Status must be active or inactive.");
      }
      values.push(req.body.status);
      updates.push(`status = $${values.length}`);
    }
    if (updates.length === 0) {
      throw new AppError(400, "VALIDATION_ERROR", "Provide full_name, employment_type, or status to update.");
    }

    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE staff
       SET ${updates.join(", ")}, updated_at = now()
       WHERE id = $${values.length}
       RETURNING ${STAFF_COLUMNS}`,
      values,
    );
    if (!result.rows[0]) {
      throw new AppError(404, "STAFF_NOT_FOUND", "Staff member not found.");
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.deactivate = async (req, res, next) => {
  try {
    validateStaffId(req.params.id);
    const result = await pool.query(
      `UPDATE staff
       SET status = 'inactive', updated_at = now()
       WHERE id = $1
       RETURNING ${STAFF_COLUMNS}`,
      [req.params.id],
    );
    if (!result.rows[0]) {
      throw new AppError(404, "STAFF_NOT_FOUND", "Staff member not found.");
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.updateBankDetails = async (req, res, next) => {
  try {
    const data = await staffBankService.updateBankDetails({
      staffId: req.params.staffId,
      bankCode: req.body.bankCode,
      bankAccountNumber: req.body.bankAccountNumber,
      user: req.user,
      ipAddress: req.ip,
    });
    res.json({ message: "Bank details updated.", data });
  } catch (error) {
    next(error);
  }
};
