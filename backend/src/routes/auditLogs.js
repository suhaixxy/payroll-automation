const express = require("express");
const yup = require("yup");
const auditController = require("../controllers/auditController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validateRequest = require("../middleware/validateRequest");
const databaseUuid = yup.string().matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const router = express.Router();
router.use(authenticate, authorize("manager"));
router.get("/", auditController.list);
router.get("/:id", validateRequest(yup.object({ id: databaseUuid.required() }), "params"), auditController.getById);
module.exports = router;
