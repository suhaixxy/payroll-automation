module.exports = {
    mode: process.env.HRMS_MODE || "mock",
    simulateFailure: () => String(process.env.HRMS_SIMULATE_FAILURE).toLowerCase() === "true",
};
