const express = require("express");
const backpayController = require("../controllers/backpayController");

const router = express.Router();

router.post("/", backpayController.create);
router.get("/", backpayController.list);
router.post("/:id/resolve", backpayController.resolve);

module.exports = router;
