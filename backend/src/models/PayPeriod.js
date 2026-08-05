module.exports = (sequelize, DataTypes) => {
    const PayPeriod = sequelize.define("PayPeriod", {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        start_date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        end_date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM(
                "draft",
                "validated",
                "pending_calculation",
                "pending_approval",
                "approved",
                "payment_ready"
            ),
            defaultValue: "draft"
        },
        validated_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        total_gross: {
            type: DataTypes.DECIMAL(12,2),
            allowNull: true
        },
        total_net: {
            type: DataTypes.DECIMAL(12,2),
            allowNull: true
        },
        is_locked: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        locked_at: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: "pay_period",
        underscored: true,
        timestamps: true
    });
    return PayPeriod;
};
