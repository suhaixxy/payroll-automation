module.exports = (sequelize, DataTypes) => {
    const PayrollLine = sequelize.define("PayrollLine", {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        run_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        period_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        staff_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        gross_total: {
            type: DataTypes.DECIMAL(12,2),
            defaultValue: 0
        },
        incentive_amount: {
            type: DataTypes.DECIMAL(12,2),
            defaultValue: 0
        },
        cpf_employee: {
            type: DataTypes.DECIMAL(12,2),
            defaultValue: 0
        },
        sdl: {
            type: DataTypes.DECIMAL(12,2),
            defaultValue: 0
        },
        net_pay: {
            type: DataTypes.DECIMAL(12,2),
            defaultValue: 0
        },
        line_status: {
            type: DataTypes.ENUM(
                "complete",
                "incomplete"
            ),
            defaultValue: "complete"
        }
    }, {
        tableName: "payroll_lines",
        underscored: true,
        timestamps: false
    });
    return PayrollLine;
};
