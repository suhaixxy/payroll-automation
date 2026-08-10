// // Generates the UC-005 bank payment CSV for payroll batch export.
const { stringify } = require("csv-stringify/sync");

exports.generateCsv = (batch, items) =>
  stringify(
    items.map((item) => ({
      "Batch Reference": batch.batch_reference,
      "Employee Reference": item.employee_reference,
      "Employee Name": item.employee_name,
      "Bank Code": item.bank_code,
      "Bank Account Number": item.bank_account_no,
      "Approved Net Pay Amount": Number(item.net_pay).toFixed(2),
      "Payment Reference": item.payment_reference,
    })),
    { header: true }
  );