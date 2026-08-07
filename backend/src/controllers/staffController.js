const staffBankService = require("../services/staffBankService");

exports.updateBankDetails = async (req, res, next) => {
    try {
        const data = await staffBankService.updateBankDetails({
            staffId: req.params.staffId,
            bankCode: req.body.bankCode,
            bankAccountNumber: req.body.bankAccountNumber,
            user: req.user,
            ipAddress: req.ip,
        });
        res.json({ message: "Bank details updated.", data });
    } catch (error) { next(error); }
};
