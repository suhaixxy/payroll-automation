module.exports = (accountNumber) => {
    if (!accountNumber) return null;
    const value = String(accountNumber);
    return `XXXX${value.slice(-4).padStart(4, "X")}`;
};
