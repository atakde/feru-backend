const monitoringService = require('../monitoring');

const createMonitoring = async (req, res) => {
  const { url, device, regions, type, interval } = req.body;
  const userID = req.user && req.user.id ? req.user.id : null;

  if (!userID) return res.status(401).json({ message: 'Unauthorized' });
  if (!url) return res.status(400).json({ message: 'URL is required' });
  if (!device) return res.status(400).json({ message: 'Device is required' });
  if (!regions || (Array.isArray(regions) && regions.length === 0)) return res.status(400).json({ message: 'Regions are required' });
  if (!interval) return res.status(400).json({ message: 'Interval is required' });

  const userType = req.user.user_type;

  switch (userType) {
    case 'FREE':
      const existingEntries = await monitoringService.listMonitoringEntries(userID);
      if (existingEntries.length >= 2) {
        return res.status(403).json({ message: 'Free plan limit reached. Upgrade to create more monitoring entries.' });
      }
      break;
    default:
      return res.status(403).json({ message: 'Unknown user type' });
  }

  try {
    const created = await monitoringService.createMonitoring({ url, device, regions, type, interval, user_id: userID });
    return res.status(201).json(created);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to create monitoring entry', error: err.message });
  }
};

const listMonitoringEntries = async (req, res) => {
  try {
    const response = await monitoringService.listMonitoringEntries(req.user.id);
    return res.json(response);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to list monitoring entries' });
  }
};

const deleteMonitoringEntry = async (req, res) => {
  const { id } = req.params;
  try {
    const entry = await monitoringService.getMonitoringEntry(id);
    if (!entry) return res.status(404).json({ message: 'Monitoring entry not found' });

    if (entry.user_id !== (req.user && req.user.id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const ok = await monitoringService.deleteMonitoringEntry(id);
    if (!ok) return res.status(404).json({ message: 'Monitoring entry not found' });
    return res.json({ message: 'Monitoring entry deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to delete monitoring entry' });
  }
};

const triggerRun = async (req, res) => {
  const { id } = req.params;
  const ip = req?.ip || null;
  try {
    const entry = await monitoringService.getMonitoringEntry(id);
    if (!entry) return res.status(404).json({ message: 'Monitoring entry not found' });

    if (entry.user_id !== (req.user && req.user.id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const result = await monitoringService.triggerRun(id, ip);
    return res.status(202).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to trigger run', error: err.message });
  }
};

module.exports = { createMonitoring, listMonitoringEntries, deleteMonitoringEntry, triggerRun };
