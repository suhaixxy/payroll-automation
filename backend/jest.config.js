// Other members' test files are still empty placeholders (0 bytes) —
// Jest treats an empty suite as a failure, so they're skipped here until
// each person adds real tests. Remove a path below once that file has
// real tests in it.
module.exports = {
  testPathIgnorePatterns: [
    '/node_modules/',
    'tests/validation.test.js',
    'tests/approval.test.js',
    'tests/payment.test.js',
  ],
};
