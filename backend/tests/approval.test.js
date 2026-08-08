// Placeholder (scaffold) — an empty file fails the whole jest run, so this
// carries a todo until the UC-004 owner adds real tests.
test.todo('UC-004 approval flow tests (owner: UC-004)');
const approvalService = require("../src/services/approvalService");

// Access the internal validationError via submitDecision's behaviour by
// re-implementing tests against the exported pure logic. Since validationError
// is not exported, we test it through a small re-require of the module's rules.

// validationError is not exported, so we test the same rules it enforces
// by calling submitDecision with inputs that fail BEFORE any DB access.
// To keep these tests DB-free, we test the pure validation branch only.

describe("UC-004 Approve Payroll - validation rules", () => {
  const validBase = {
    payPeriodId: "11111111-1111-1111-1111-111111111111",
    approvedBy: "Managing Director",
  };

  test("rejecting without a comment is blocked with COMMENT_REQUIRED", async () => {
    const result = await approvalService.submitDecision({
      ...validBase,
      decision: "rejected",
      comment: "",
    });
    expect(result).toEqual(
      expect.objectContaining({ error: "COMMENT_REQUIRED" })
    );
  });

  test("a missing decision is blocked with VALIDATION_ERROR", async () => {
    const result = await approvalService.submitDecision({
      ...validBase,
      decision: "maybe",
    });
    expect(result).toEqual(
      expect.objectContaining({ error: "VALIDATION_ERROR" })
    );
  });

  test("a missing approver is blocked with VALIDATION_ERROR", async () => {
    const result = await approvalService.submitDecision({
      payPeriodId: validBase.payPeriodId,
      decision: "approved",
      approvedBy: "   ",
    });
    expect(result).toEqual(
      expect.objectContaining({ error: "VALIDATION_ERROR" })
    );
  });

  test("a missing payPeriodId is blocked with VALIDATION_ERROR", async () => {
    const result = await approvalService.submitDecision({
      decision: "approved",
      approvedBy: "Managing Director",
    });
    expect(result).toEqual(
      expect.objectContaining({ error: "VALIDATION_ERROR" })
    );
  });
});

describe("UC-004 Approve Payroll - service exports", () => {
  test("exposes the four approval service functions", () => {
    expect(typeof approvalService.listPayPeriods).toBe("function");
    expect(typeof approvalService.getSummary).toBe("function");
    expect(typeof approvalService.getLineDetail).toBe("function");
    expect(typeof approvalService.submitDecision).toBe("function");
  });
});
