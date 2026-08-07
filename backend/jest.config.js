const path = require("path");

module.exports = {
  testEnvironment: "node",

  testPathIgnorePatterns: ["/node_modules/"],

  roots: [
    path.resolve(__dirname, "tests"),
    path.resolve(__dirname, "../tests"),
  ],

  moduleNameMapper: {
    "^supertest$": require.resolve("supertest"),
  },

  // `npm run test:coverage` measures UC-003-owned code ONLY. Including the
  // other use cases' not-yet-built files would dilute the number to
  // meaninglessness — each owner should scope their own coverage the same
  // way. uc003SeedService is excluded: it's a boot-time demo-data helper,
  // not part of the calculation path.
  collectCoverageFrom: [
    "src/services/calculationEngine.js",
    "src/services/runService.js",
    "src/services/rateSetService.js",
    "src/services/adjustmentService.js",
    "src/services/performanceInputService.js",
    "src/services/uc003AuditService.js",
    "src/services/authService.js",
    "src/controllers/uc003Controller.js",
    "src/controllers/adjustmentController.js",
    "src/controllers/performanceInputController.js",
    "src/controllers/rateSetController.js",
    "src/controllers/userController.js",
    "src/middleware/*.js",
  ],

  // The calculation engine is the money-critical file — it is held to a
  // higher bar than the HTTP plumbing around it. A failing threshold fails
  // the test run, so these are floors the team must not regress below.
  coverageThreshold: {
    "src/services/calculationEngine.js": {
      statements: 95,
      branches: 90,
      functions: 100,
      lines: 95,
    },
    global: {
      statements: 80,
      branches: 65,
      functions: 85,
      lines: 80,
    },
  },
};
