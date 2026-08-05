// Shared pay-period status contract (UC-003 guide §5.1) — the ONE place the
// status strings live. Backend requires this file (Node >= 20.19 supports
// require() of ESM); frontend imports it through Vite. Do not hardcode these
// strings anywhere else.
//
//   draft → validated → calculated → pending_approval → approved → paid
//
// UC-003 owns exactly two transitions:
//   validated  → calculated        (a calculation run completes)
//   calculated → pending_approval  (manager submits to approval)
// UC-003 must never write 'approved' or 'paid'.

export const PAYROLL_STATUS = Object.freeze({
  DRAFT: 'draft',
  VALIDATED: 'validated',
  CALCULATED: 'calculated',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  PAID: 'paid',
});

// Full lifecycle in order — useful for progress displays and validation.
export const STATUS_ORDER = Object.freeze([
  PAYROLL_STATUS.DRAFT,
  PAYROLL_STATUS.VALIDATED,
  PAYROLL_STATUS.CALCULATED,
  PAYROLL_STATUS.PENDING_APPROVAL,
  PAYROLL_STATUS.APPROVED,
  PAYROLL_STATUS.PAID,
]);

// Once a period reaches these, UC-003 data (adjustments, performance inputs)
// is locked and recalculation is refused with 409 (guide §2.6 / §5.9).
export const UC003_LOCKED_STATUSES = Object.freeze([
  PAYROLL_STATUS.APPROVED,
  PAYROLL_STATUS.PAID,
]);

export function isUc003Locked(status) {
  return UC003_LOCKED_STATUSES.includes(status);
}
