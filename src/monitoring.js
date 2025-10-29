const { v4: uuidv4 } = require('uuid');
const pool = require('./db');
const { run } = require('./lighthouse-runner');

async function createMonitoring({ url, device, regions, user_id, interval, type = 'lighthouse' }) {
  const id = uuidv4();
  const parsedRegions = Array.isArray(regions) ? regions : (String(regions || '')).split(',').map(r => r.trim());
  const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;

  const result = await pool.execute(
    `INSERT INTO monitoring (id, url, device, type, user_id, regions, \`interval\`) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, urlWithProtocol, device, type, user_id, JSON.stringify(parsedRegions), interval]
  );

  if (result[0].affectedRows === 0) {
    throw new Error('Failed to create monitoring entry');
  }

  return { id, url: urlWithProtocol, device, type, interval, user_id, regions: parsedRegions };
}

async function listMonitoringEntries(userID) {
  const [rows] = await pool.execute(`SELECT * FROM monitoring WHERE user_id = ? ORDER BY created_at DESC`, [userID]);
  return rows.map(r => ({
    id: r.id,
    url: r.url,
    device: r.device,
    type: r.type,
    user_id: r.user_id,
    interval: r.interval,
    regions: r.regions,
    created_at: r.created_at,
    last_run_at: r.last_run_at,
    status: r.status
  }));
}

async function deleteMonitoringEntry(id) {
  const [result] = await pool.execute(`DELETE FROM monitoring WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

async function getMonitoringEntry(id) {
  const [rows] = await pool.execute(`SELECT * FROM monitoring WHERE id = ? LIMIT 1`, [id]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    url: r.url,
    device: r.device,
    type: r.type,
    user_id: r.user_id,
    regions: r.regions,
    created_at: r.created_at,
    last_run_at: r.last_run_at,
    status: r.status
  };
}

async function triggerRun(monitorId, ip = null) {
  const entry = await getMonitoringEntry(monitorId);
  if (!entry) throw new Error('Monitoring entry not found');

  if (entry.type !== 'lighthouse') {
    throw new Error(`Unsupported monitoring type for trigger: ${entry.type}`);
  }

  const jobId = uuidv4();

  await pool.execute(
    `INSERT INTO lighthouse_job (id, url, device, regions, ip, status) VALUES (?, ?, ?, ?, ?, 'PENDING')`,
    [jobId, entry.url, entry.device, JSON.stringify(entry.regions), ip]
  );

  const resultRows = entry.regions.map(r => [uuidv4(), jobId, r, 'PENDING']);
  await pool.query(`INSERT INTO lighthouse_result (id, job_id, region, status) VALUES ?`, [resultRows]);

  // Start tasks per region
  const startResults = [];
  for (const eachRegion of entry.regions) {
    const resultID = resultRows.find(rr => rr[2] === eachRegion)[0];
    const taskResult = await run({ resultID, url: entry.url, device: entry.device, region: eachRegion });
    startResults.push({ region: eachRegion, taskResult });
    if (!taskResult || !taskResult.taskArn) {
      await pool.execute(
        `UPDATE lighthouse_result SET status = 'FAILED', completed_at = NOW() WHERE id = ?`,
        [resultID]
      );
    }
  }

  await pool.execute(
    `INSERT INTO monitoring_job_mapping (monitoring_id, job_id) VALUES (?, ?)`,
    [monitorId, jobId]
  );

  await pool.execute(`UPDATE monitoring SET last_run_at = NOW() WHERE id = ?`, [monitorId]);

  return { jobId, startResults };
}

module.exports = { createMonitoring, listMonitoringEntries, deleteMonitoringEntry, getMonitoringEntry, triggerRun };
