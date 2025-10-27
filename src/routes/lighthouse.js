const express = require("express");
const { getResultsById, runNewAudit, updateResults } = require("../controllers/lighthouseController");
const router = express.Router();
const authenticate = require("../middlewares/authMiddleware");

// Protected routes
router.get("/:id", authenticate, getResultsById);

// Public routes
router.post("/", runNewAudit);
router.post("/system/webhook", updateResults);

module.exports = router;
