const express = require('express');
const router = express.Router();
const { createMonitoring, listMonitoringEntries, deleteMonitoringEntry, triggerRun } = require('../controllers/monitoringController');
const requireAuthMw = require('../middlewares/requireAuthMiddleware');

router.use(requireAuthMw);

router.post('/', createMonitoring);
router.get('/', listMonitoringEntries);
router.delete('/:id', deleteMonitoringEntry);
// router.post('/:id/run', triggerRun);

module.exports = router;
