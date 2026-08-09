jest.mock("../src/config/database", () => ({
  pool: { query: jest.fn() },
}));
jest.mock("../src/services/staffBankService", () => ({
  updateBankDetails: jest.fn(),
}));

const { pool } = require("../src/config/database");
const staffController = require("../src/controllers/staffController");

const staffId = "11111111-1111-1111-1111-111111111111";
const staffMember = {
  id: staffId,
  externalRef: "S001",
  fullName: "Andrea Chua",
  employmentType: "full_time",
  department: "Operations",
  role: "Manager",
  email: "andrea@example.com",
  phone: "91234567",
  dateJoined: "2026-01-01",
  maxWeeklyHours: "44",
  status: "active",
};

function createResponse() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("staffController", () => {
  describe("list", () => {
    test("returns all staff records", async () => {
      pool.query.mockResolvedValue({ rows: [staffMember] });
      const res = createResponse();
      const next = jest.fn();

      await staffController.list({ query: {} }, res, next);

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("FROM staff ORDER BY full_name"));
      expect(res.json).toHaveBeenCalledWith([staffMember]);
      expect(next).not.toHaveBeenCalled();
    });

    test("returns only active staff when requested", async () => {
      pool.query.mockResolvedValue({ rows: [staffMember] });
      const res = createResponse();

      await staffController.list({ query: { status: "active" } }, res, jest.fn());

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("WHERE status = 'active'"));
      expect(res.json).toHaveBeenCalledWith([staffMember]);
    });

    test("rejects an invalid status filter", async () => {
      const next = jest.fn();

      await staffController.list({ query: { status: "inactive" } }, createResponse(), next);

      expect(pool.query).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400, code: "INVALID_STATUS_FILTER" }));
    });
  });

  describe("getById", () => {
    test("returns a staff member", async () => {
      pool.query.mockResolvedValue({ rows: [staffMember] });
      const res = createResponse();

      await staffController.getById({ params: { id: staffId } }, res, jest.fn());

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("FROM staff WHERE id = $1"), [staffId]);
      expect(res.json).toHaveBeenCalledWith(staffMember);
    });

    test("returns 404 when the staff member is not found", async () => {
      pool.query.mockResolvedValue({ rows: [] });
      const next = jest.fn();

      await staffController.getById({ params: { id: staffId } }, createResponse(), next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404, code: "STAFF_NOT_FOUND" }));
    });

    test("rejects an invalid staff ID", async () => {
      const next = jest.fn();

      await staffController.getById({ params: { id: "invalid" } }, createResponse(), next);

      expect(pool.query).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400, code: "INVALID_STAFF_ID" }));
    });
  });

  describe("create", () => {
    test("creates a staff member with all fields", async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [staffMember] });
      const res = createResponse();
      const body = {
        external_ref: "S001",
        full_name: "Andrea Chua",
        employment_type: "full_time",
        department: "Operations",
        role: "Manager",
        email: "andrea@example.com",
        phone: "91234567",
        date_joined: "2026-01-01",
        max_weekly_hours: 44,
      };

      await staffController.create({ body }, res, jest.fn());

      expect(pool.query).toHaveBeenNthCalledWith(1, "SELECT 1 FROM staff WHERE external_ref = $1", ["S001"]);
      expect(pool.query).toHaveBeenNthCalledWith(2, expect.stringContaining("INSERT INTO staff"), ["S001", "Andrea Chua", "full_time", "Operations", "Manager", "andrea@example.com", "91234567", "2026-01-01", 44]);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(staffMember);
    });

    test("rejects missing required fields", async () => {
      const next = jest.fn();

      await staffController.create({ body: { external_ref: "S001" } }, createResponse(), next);

      expect(pool.query).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    test("rejects an invalid employment type", async () => {
      const next = jest.fn();

      await staffController.create({ body: { external_ref: "S001", full_name: "Andrea Chua", employment_type: "contract" } }, createResponse(), next);

      expect(pool.query).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400, code: "INVALID_EMPLOYMENT_TYPE" }));
    });

    test("rejects an invalid email format", async () => {
      const next = jest.fn();

      await staffController.create({ body: { external_ref: "S001", full_name: "Andrea Chua", employment_type: "full_time", email: "invalid-email" } }, createResponse(), next);

      expect(pool.query).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    test("rejects a duplicate external reference", async () => {
      pool.query.mockResolvedValue({ rows: [{ exists: 1 }] });
      const next = jest.fn();

      await staffController.create({ body: { external_ref: "S001", full_name: "Andrea Chua", employment_type: "full_time" } }, createResponse(), next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 409, code: "STAFF_EXTERNAL_REF_EXISTS" }));
    });
  });

  describe("update", () => {
    test("updates provided staff fields", async () => {
      pool.query.mockResolvedValue({ rows: [staffMember] });
      const res = createResponse();
      const body = { full_name: "Andrea Tan", department: "Finance", email: "andrea.tan@example.com", date_joined: "2026-02-01", max_weekly_hours: 40 };

      await staffController.update({ params: { id: staffId }, body }, res, jest.fn());

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("full_name = $1, department = $2, email = $3, date_joined = $4, max_weekly_hours = $5"), ["Andrea Tan", "Finance", "andrea.tan@example.com", "2026-02-01", 40, staffId]);
      expect(res.json).toHaveBeenCalledWith(staffMember);
    });

    test("rejects an update with no fields", async () => {
      const next = jest.fn();

      await staffController.update({ params: { id: staffId }, body: {} }, createResponse(), next);

      expect(pool.query).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    test.each([
      [{ employment_type: "contract" }, "INVALID_EMPLOYMENT_TYPE"],
      [{ status: "pending" }, "INVALID_STAFF_STATUS"],
      [{ email: "invalid-email" }, "VALIDATION_ERROR"],
    ])("rejects an update with %s", async (body, code) => {
      const next = jest.fn();

      await staffController.update({ params: { id: staffId }, body }, createResponse(), next);

      expect(pool.query).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400, code }));
    });

    test("returns 404 when the staff member does not exist", async () => {
      pool.query.mockResolvedValue({ rows: [] });
      const next = jest.fn();

      await staffController.update({ params: { id: staffId }, body: { phone: "91234567" } }, createResponse(), next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404, code: "STAFF_NOT_FOUND" }));
    });
  });

  describe("deactivate", () => {
    test("sets a staff member to inactive", async () => {
      const inactiveStaff = { ...staffMember, status: "inactive" };
      pool.query.mockResolvedValue({ rows: [inactiveStaff] });
      const res = createResponse();

      await staffController.deactivate({ params: { id: staffId } }, res, jest.fn());

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("SET status = 'inactive'"), [staffId]);
      expect(res.json).toHaveBeenCalledWith(inactiveStaff);
    });

    test("returns 404 when the staff member does not exist", async () => {
      pool.query.mockResolvedValue({ rows: [] });
      const next = jest.fn();

      await staffController.deactivate({ params: { id: staffId } }, createResponse(), next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404, code: "STAFF_NOT_FOUND" }));
    });
  });
});
