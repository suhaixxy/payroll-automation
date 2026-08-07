const HEADER = [
    "Batch Reference",
    "Employee Reference",
    "Employee Name",
    "Bank Code",
    "Bank Account Number",
    "Approved Net Pay Amount",
    "Payment Reference",
];

const escapeCsvField = (value) => {
    if (value === null || value === undefined) {
        return "";
    }

    const text = String(value);

    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
};

const formatNetPay = (value) => {
    if (value === null || value === undefined || value === "") {
        return "";
    }

    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        throw new TypeError(
            `Cannot generate GIRO CSV: invalid net pay value "${value}".`
        );
    }

    return amount.toFixed(2);
};

function generateGiroCsv(batch, batchItems) {
    if (!batch) {
        throw new Error("Cannot generate GIRO CSV: batch is required.");
    }

    if (!batch.batch_reference) {
        throw new Error(
            "Cannot generate GIRO CSV: batch.batch_reference is required."
        );
    }

    if (!Array.isArray(batchItems)) {
        throw new TypeError(
            "Cannot generate GIRO CSV: batchItems must be an array."
        );
    }

    if (batchItems.length === 0) {
        throw new Error(
            "Cannot generate GIRO CSV: batchItems must not be empty."
        );
    }

    const rows = batchItems.map((item, index) => {
        if (!item) {
            throw new TypeError(
                `Cannot generate GIRO CSV: batch item at index ${index} is invalid.`
            );
        }

        return [
            batch.batch_reference,
            item.employee_reference,
            item.employee_name,
            item.bank_code,
            item.bank_account_no,
            formatNetPay(item.net_pay),
            item.payment_reference,
        ]
            .map(escapeCsvField)
            .join(",");
    });

    return {
        filename: `Payroll_${batch.batch_reference}.csv`,
        mimeType: "text/csv",
        content: [HEADER.join(","), ...rows].join("\r\n"),
    };
}

module.exports = generateGiroCsv;
