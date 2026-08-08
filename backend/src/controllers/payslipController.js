const payslipService = require("../services/payslipService");

const context = (req) => ({ user: req.user, ipAddress: req.ip });

exports.listForBatch = async (req, res, next) => {
    try { res.json({ rows: await payslipService.listForBatch({ batchId: req.params.batchId, ...context(req) }) }); } catch (error) { next(error); }
};

exports.listMine = async (req, res, next) => {
    try { res.json({ rows: await payslipService.listMine(context(req)) }); } catch (error) { next(error); }
};

exports.listAll = async (req, res, next) => {
    try { res.json({ rows: await payslipService.listAll(context(req)) }); } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
    try {
        const payslip = await payslipService.getById({ payslipId: req.params.payslipId, ...context(req) });
        res.json(payslipService.serialize(payslip));
    } catch (error) { next(error); }
};

exports.download = async (req, res, next) => {
    try {
        const file = await payslipService.createPdfDownload({ payslipId: req.params.payslipId, ...context(req) });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
        res.send(file.content);
    } catch (error) { next(error); }
};
