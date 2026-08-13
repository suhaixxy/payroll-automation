const express = require("express");
const backpayController = require("../controllers/backpayController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

const router = express.Router();
router.use(authenticate, authorize("manager"));

router.post("/", backpayController.create);
router.get("/", backpayController.list);
router.post("/:id/resolve", backpayController.resolve);

module.exports = router;
