module.exports = (sequelize, DataTypes) => {
    const Staff = sequelize.define("Staff", {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        external_ref: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false
        },
        full_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        employment_type: {
            type: DataTypes.ENUM(
                "part_time",
                "full_time"
            ),
            allowNull: false
        },
        bank_account_no: {
            type: DataTypes.STRING,
            allowNull: true
        },
        bank_code: {
            type: DataTypes.STRING,
            allowNull: true
        },
        cpf_eligible: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        status: {
            type: DataTypes.ENUM(
                "active",
                "inactive"
            ),
            defaultValue: "active"
        }
    }, {
        tableName: "staff",
        underscored: true,
        timestamps: true
    });
    return Staff;
};