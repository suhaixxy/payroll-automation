const { Staff } = require("../models");
const auditService = require("./auditService");
const maskBankAccount = require("../utils/maskBankAccount");
const AppError = require("../utils/AppError");

exports.updateBankDetails = async ({ staffId, bankCode, bankAccountNumber, user, ipAddress }) => {
    const staff = await Staff.findByPk(staffId);
    if (!staff) throw new AppError(404, "STAFF_NOT_FOUND", "Staff member not found.");
    await staff.update({ bank_code: bankCode, bank_account_no: bankAccountNumber });
    await auditService.record({
        user,
        action: "BANK_DETAILS_UPDATED",
        entityType: "staff",
        entityId: staff.id,
        ipAddress,
        details: { updatedFields: ["bankCode", "bankAccountNumber"] },
    });
    return {
        id: staff.id,
        employeeReference: staff.external_ref,
        employeeName: staff.full_name,
        bankCode: staff.bank_code,
        bankAccountNumber: maskBankAccount(staff.bank_account_no),
    };
};
