const crypto = require("crypto");

module.exports = (prefix) => {
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `${prefix}-${timestamp}-${suffix}`;
};
