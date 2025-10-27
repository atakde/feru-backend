const express = require("express");
const { getResultsById, runNewAudit, updateResults } = require("../controllers/lighthouseController");
const router = express.Router();
const authenticate = require("../middlewares/authMiddleware");

// Protected route
router.post("/", authenticate, runNewAudit);
router.get("/:id", authenticate, getResultsById);
router.post("/system/webhook", updateResults);

module.exports = router;
