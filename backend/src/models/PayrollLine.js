module.exports = (sequelize, DataTypes) => {
    const PayrollLine = sequelize.define("PayrollLine", {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        pay_period_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        staff_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        gross_pay: {
            type: DataTypes.DECIMAL(12,2),
            defaultValue: 0
        },
        incentive_pay: {
            type: DataTypes.DECIMAL(12,2),
            defaultValue: 0
        },
        cpf_amount: {
            type: DataTypes.DECIMAL(12,2),
            defaultValue: 0
        },
        sdl_amount: {
            type: DataTypes.DECIMAL(12,2),
            defaultValue: 0
        },
        net_pay: {
            type: DataTypes.DECIMAL(12,2),
            defaultValue: 0
        },
        status: {
            type: DataTypes.ENUM(
                "ok",
                "incomplete"
            ),
            defaultValue: "ok"
        }
    }, {
        tableName: "payroll_line",
        underscored: true,
        timestamps: true
    });
    return PayrollLine;
};