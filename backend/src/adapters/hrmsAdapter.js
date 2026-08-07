const crypto = require("crypto");
const hrmsConfig = require("../config/hrms");

exports.sync = async (payload) => {
    if (hrmsConfig.mode !== "mock") {
        return {
            success: false,
            externalReference: null,
            errorCode: "HRMS_MODE_UNAVAILABLE",
            errorMessage: "Configured HRMS adapter is unavailable."
        };
    }

    if (hrmsConfig.simulateFailure()) {
        return {
            success: false,
            externalReference: null,
            errorCode: "MOCK_HRMS_FAILURE",
            errorMessage: "Mock HRMS synchronisation failed."
        };
    }

    return {
        success: true,
        externalReference: `HRMS-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
        errorCode: null,
        errorMessage: null,
        acceptedRecords: payload.payrollRecords.length,
    };
};