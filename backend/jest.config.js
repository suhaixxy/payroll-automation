const path = require("path");

module.exports = {
  testEnvironment: "node",
  roots: [
    path.resolve(__dirname, "tests"),
    path.resolve(__dirname, "../tests"),
  ],
};