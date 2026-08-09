const express = require("express");
const router = express.Router();
const approvalController = require("../controllers/approvalController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

router.use(authenticate, authorize("manager"));

router.get("/periods", approvalController.listPayPeriods);
router.get("/summary", approvalController.getSummary);
router.get("/lines/:lineId", approvalController.getLineDetail);
router.post("/", approvalController.submitDecision);

module.exports = router;
