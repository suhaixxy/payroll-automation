// STUB: returns fake data until real HRMS API access is set up.
// Real implementation would authenticate and push payroll records to the actual HRMS system.

async function syncToHrms(paymentBatch) {
  console.log("STUB: pretending to sync payment batch to HRMS", paymentBatch.id);
  return { success: true, hrmsReference: `FAKE-HRMS-${Date.now()}` };
}

module.exports = { syncToHrms };