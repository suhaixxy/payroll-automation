const generateGiroCsv = require("../../backend/src/utils/giroFileFormatter");

describe("GIRO CSV formatter", () => {
    test("escapes commas, double quotes, and newlines using CSV quoting rules", () => {
        const result = generateGiroCsv(
            { batch_reference: "PAY-TEST-ESCAPING" },
            [{
                employee_reference: "EMP,001",
                employee_name: "Ada \"Ace\" Wong",
                bank_code: "DBS\nSG",
                bank_account_no: "123456789",
                net_pay: 42.5,
                payment_reference: "PAY-REF-001",
            }],
        );

        expect(result).toMatchObject({
            filename: "Payroll_PAY-TEST-ESCAPING.csv",
            mimeType: "text/csv",
        });
        expect(result.content).toBe(
            "Batch Reference,Employee Reference,Employee Name,Bank Code,Bank Account Number,Approved Net Pay Amount,Payment Reference\r\n"
            + "PAY-TEST-ESCAPING,\"EMP,001\",\"Ada \"\"Ace\"\" Wong\",\"DBS\nSG\",123456789,42.50,PAY-REF-001",
        );
    });
});
