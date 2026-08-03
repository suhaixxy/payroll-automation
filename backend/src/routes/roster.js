const express = require("express");
const router = express.Router();

// Placeholder — real logic goes here later (UC-001)
router.get("/", (req, res) => {
  res.json({ message: "Roster route placeholder" });
});

module.exports = router;