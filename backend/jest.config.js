// All placeholder test files now contain a test.todo (an empty file would
// fail the whole run), so nothing needs to be skipped anymore. Each use
// case's owner replaces their todo with real tests.
module.exports = {
  testPathIgnorePatterns: ['/node_modules/'],
};
