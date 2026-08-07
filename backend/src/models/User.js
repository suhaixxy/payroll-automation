module.exports = (sequelize, DataTypes) => sequelize.define("User", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    full_name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING(255), allowNull: false },
    role: {
        type: DataTypes.ENUM("manager", "employee"),
        allowNull: false,
    },
    staff_id: { type: DataTypes.UUID, allowNull: true, unique: true },
    status: {
        type: DataTypes.ENUM("active", "disabled"),
        allowNull: false,
        defaultValue: "active",
    },
    last_login_at: { type: DataTypes.DATE, allowNull: true },
}, {
    tableName: "user_account",
    underscored: true,
    timestamps: true,
});
