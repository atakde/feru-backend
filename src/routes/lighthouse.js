const express = require("express");
const { getResultsById, getAllTestsByUser, runNewAudit, updateResults } = require("../controllers/lighthouseController");
const router = express.Router();
const requireAuthMw = require("../middlewares/requireAuthMiddleware");

router.get("/all", requireAuthMw, getAllTestsByUser);
router.get("/:id", getResultsById);
router.post("/", runNewAudit);
router.post("/system/webhook", updateResults);

module.exports = router;
