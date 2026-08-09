jest.mock("../src/config/database", () => ({
  pool: { query: jest.fn() },
}));
jest.mock("../src/adapters/googleSheetsAdapter", () => ({
  fetchRosterRows: jest.fn(),
}));
jest.mock("../src/services/rosterSyncService", () => ({}));

const { pool } = require("../src/config/database");
const { fetchRosterRows } = require("../src/adapters/googleSheetsAdapter");
const { getSourceHealth } = require("../src/controllers/rosterController");

function createResponse() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

test.each([
  ["both connected", false, false, { database: "connected", googleSheet: "connected" }],
  ["database down", true, false, { database: "disconnected", googleSheet: "connected" }],
  ["Google Sheet down", false, true, { database: "connected", googleSheet: "disconnected" }],
  ["both down", true, true, { database: "disconnected", googleSheet: "disconnected" }],
])("reports health when %s", async (_label, databaseDown, sheetDown, expected) => {
  if (databaseDown) pool.query.mockRejectedValue(new Error("Database unavailable"));
  else pool.query.mockResolvedValue({ rows: [{ "?column?": 1 }] });
  if (sheetDown) fetchRosterRows.mockRejectedValue(new Error("Sheet unavailable"));
  else fetchRosterRows.mockResolvedValue([]);
  const res = createResponse();

  await getSourceHealth({}, res);

  expect(pool.query).toHaveBeenCalledWith("SELECT 1");
  expect(fetchRosterRows).toHaveBeenCalledTimes(1);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(expected);
});
