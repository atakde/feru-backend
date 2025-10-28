const express = require("express");
const { getResultsById, runNewAudit, updateResults } = require("../controllers/lighthouseController");
const router = express.Router();

router.get("/:id", getResultsById);
router.post("/", runNewAudit);
router.post("/system/webhook", updateResults);

module.exports = router;
