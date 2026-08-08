const express = require("express");
const staffController = require("../controllers/staffController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validateRequest = require("../middleware/validateRequest");
const { staffParamsSchema, bankDetailsSchema } = require("../validators/paymentValidator");

const router = express.Router();
router.use(authenticate, authorize("manager"));

router.get("/", staffController.list);
router.get("/:id", staffController.getById);
router.post("/", staffController.create);
router.patch("/:id", staffController.update);
router.delete("/:id", staffController.deactivate);

router.patch("/:staffId/bank-details", validateRequest(staffParamsSchema, "params"), validateRequest(bankDetailsSchema), staffController.updateBankDetails);

module.exports = router;
