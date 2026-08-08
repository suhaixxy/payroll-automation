const express = require("express");
const router = express.Router();
const approvalController = require("../controllers/approvalController");

router.get("/periods", approvalController.listPayPeriods);
router.get("/summary", approvalController.getSummary);
router.get("/lines/:lineId", approvalController.getLineDetail);
router.post("/", approvalController.submitDecision);

module.exports = router;
