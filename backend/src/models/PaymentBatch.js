module.exports = (sequelize, DataTypes) => {
    const PaymentBatch = sequelize.define("PaymentBatch", {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        pay_period_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        calculation_run_id: { type: DataTypes.UUID, allowNull: true },
        batch_reference: { type: DataTypes.STRING(50), allowNull: false, unique: true },
        file_format: {
            type: DataTypes.ENUM(
                "giro",
                "bulk_transfer"
            ),
            defaultValue: "giro"
        },
        employee_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        total_amount: { type: DataTypes.DECIMAL(14,2), allowNull: false, defaultValue: 0 },
        status: {
            type: DataTypes.ENUM(
                "generating", "generated",
                "hrms_sync_pending",
                "hrms_sync_failed",
                "completed", "cancelled"
            ),
            defaultValue: "generated"
        },
        hrms_sync_status: {
            type: DataTypes.ENUM("not_started", "pending", "failed", "completed"),
            allowNull: false,
            defaultValue: "not_started"
        },
        hrms_reference: { type: DataTypes.STRING(100), allowNull: true },
        hrms_error_message: { type: DataTypes.STRING(500), allowNull: true },
        generated_by: { type: DataTypes.UUID, allowNull: false },
        generated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        hrms_synced_at: { type: DataTypes.DATE, allowNull: true },
        cancelled_by: { type: DataTypes.UUID, allowNull: true },
        cancelled_at: { type: DataTypes.DATE, allowNull: true },
        cancellation_reason: { type: DataTypes.STRING(500), allowNull: true }
    }, {
        tableName: "payment_batch",
        underscored: true,
        timestamps: true
    });
    return PaymentBatch;
};
