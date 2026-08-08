const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const db = {
    sequelize,
    User: require("./User")(sequelize, DataTypes),
    Staff: require("./Staff")(sequelize, DataTypes),
    PayPeriod: require("./PayPeriod")(sequelize, DataTypes),
    PayrollLine: require("./PayrollLine")(sequelize, DataTypes),
    Approval: require("./Approval")(sequelize, DataTypes),
    AuditLog: require("./AuditLog")(sequelize, DataTypes),
    PaymentBatch: require("./PaymentBatch")(sequelize, DataTypes),
    PaymentBatchItem: require("./PaymentBatchItem")(sequelize, DataTypes),
    Payslip: require("./Payslip")(sequelize, DataTypes),
    // UC-003
    PayRate: require("./PayRate")(sequelize, DataTypes),
};

db.User.belongsTo(db.Staff, { foreignKey: "staff_id", as: "staff" });
db.Staff.hasOne(db.User, { foreignKey: "staff_id", as: "user" });

db.PayPeriod.hasMany(db.PayrollLine, { foreignKey: "period_id", as: "payrollLines" });
db.PayrollLine.belongsTo(db.PayPeriod, { foreignKey: "period_id", as: "payPeriod" });
db.Staff.hasMany(db.PayrollLine, { foreignKey: "staff_id", as: "payrollLines" });
db.PayrollLine.belongsTo(db.Staff, { foreignKey: "staff_id", as: "staff" });

db.PayPeriod.hasMany(db.Approval, { foreignKey: "pay_period_id", as: "approvals" });
db.Approval.belongsTo(db.PayPeriod, { foreignKey: "pay_period_id", as: "payPeriod" });

db.PayPeriod.hasMany(db.PaymentBatch, { foreignKey: "pay_period_id", as: "paymentBatches" });
db.PaymentBatch.belongsTo(db.PayPeriod, { foreignKey: "pay_period_id", as: "payPeriod" });
db.User.hasMany(db.PaymentBatch, { foreignKey: "generated_by", as: "generatedPaymentBatches" });
db.PaymentBatch.belongsTo(db.User, { foreignKey: "generated_by", as: "generator" });

db.PaymentBatch.hasMany(db.PaymentBatchItem, { foreignKey: "payment_batch_id", as: "items" });
db.PaymentBatchItem.belongsTo(db.PaymentBatch, { foreignKey: "payment_batch_id", as: "paymentBatch" });
db.PaymentBatchItem.belongsTo(db.PayrollLine, { foreignKey: "payroll_line_id", as: "payrollLine" });
db.PaymentBatchItem.belongsTo(db.Staff, { foreignKey: "staff_id", as: "staff" });

db.PaymentBatch.hasMany(db.Payslip, { foreignKey: "payment_batch_id", as: "payslips" });
db.Payslip.belongsTo(db.PaymentBatch, { foreignKey: "payment_batch_id", as: "paymentBatch" });
db.Payslip.hasOne(db.PaymentBatchItem, { foreignKey: "payroll_line_id", sourceKey: "payroll_line_id", as: "paymentItem" });
db.Payslip.belongsTo(db.PayrollLine, { foreignKey: "payroll_line_id", as: "payrollLine" });
db.Staff.hasMany(db.Payslip, { foreignKey: "staff_id", as: "payslips" });
db.Payslip.belongsTo(db.Staff, { foreignKey: "staff_id", as: "staff" });

db.User.hasMany(db.AuditLog, { foreignKey: "user_id", as: "auditLogs" });
db.AuditLog.belongsTo(db.User, { foreignKey: "user_id", as: "user" });

module.exports = db;
