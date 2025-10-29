const { v4: uuidv4 } = require("uuid");
const { run } = require("../lighthouse-runner");
const pool = require("../db");

const getResultsById = async (req, res) => {
  const { id } = req.params;
  const [rows] = await pool.execute(
    "SELECT * FROM lighthouse_job WHERE id = ? LIMIT 1",
    [id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ message: "Lighthouse job not found" });
  }

  const job = rows[0];
  /*
  const currentUser = req.user;
  if (job.user_id !== currentUser.id) {
    return res.status(403).json({ message: "Forbidden" });
  }
  */

  // Fetch associated results
  const [resultRows] = await pool.execute(
    "SELECT * FROM lighthouse_result WHERE job_id = ?",
    [id]
  );

  if (resultRows.length === 0) {
    return res.status(404).json({ message: "No results found for this job" });
  }

  const results = resultRows.map((result) => ({
    id: result.id,
    region: result.region,
    status: result.status,
    created_at: result.created_at,
    s3_report_url: result.s3_report_url,
    metrics: {
      lcp: result.lcp,
      fcp: result.fcp,
      cls: result.cls,
      tbt: result.tbt,
      tti: result.tti,
      ttfb: result.ttfb,
      performance_score: result.performance_score
    },
  }));

  return res.status(200).json({
    status: job.status,
    url: job.url,
    device: job.device,
    ip: job.ip,
    username: job.username,
    created_at: job.created_at,
    completed_at: job.completed_at,
    results
  });
};

const runNewAudit = async (req, res) => {
  const { url, device, region } = req.body;

  if (!url) {
    res.status(400).json({ message: "URL is required" });
  }

  if (!device) {
    res.status(400).json({ message: "Device is required" });
  }

  if (!region) {
    res.status(400).json({ message: "Region is required" });
  }
  const userID = req.user ? req.user.id : null;

  const parsedRegions = region.split(',').map(r => r.trim());
  const availableRegions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1', 'eu-central-1'];
  if (!parsedRegions.every(r => availableRegions.includes(r))) {
    res.status(400).json({ message: "Invalid region(s) provided" });
  }

  const urlWithProtocol = url.startsWith('https') ? url : `https://${url}`;
  const ip = req?.ip;
  const id = uuidv4();
  // Insert to lighthouse_job
  const result = await pool.execute(
    `INSERT INTO lighthouse_job (id, url, device, regions, ip, status, user_id) 
     VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`,
    [
      id,
      urlWithProtocol,
      device,
      JSON.stringify(parsedRegions),
      ip,
      userID
    ]
  );

  if (result.affectedRows === 0) {
    return res.status(500).json({ message: "Failed to create lighthouse job" });
  }

  // Pre-create result rows for each region
  const resultRows = parsedRegions.map(r => [uuidv4(), id, r, 'PENDING']);
  const insertResults = await pool.query(
    `INSERT INTO lighthouse_result (id, job_id, region, status) VALUES ?`,
    [resultRows]
  );

  if (insertResults.affectedRows === 0) {
    return res.status(500).json({ message: "Failed to create lighthouse result entries" });
  }

  let hasErrorInLHService = false;
  for (const eachRegion of parsedRegions) {
    let resultID = resultRows.find(r => r[2] === eachRegion)[0];
    const taskResult = await run({
      resultID,
      url: urlWithProtocol,
      device,
      region: eachRegion
    });

    console.log("Task Result:", taskResult);
    if (!taskResult || !taskResult.taskArn) {
      console.error("Failed to start lighthouse audit:", taskResult);
      await pool.execute(
        `UPDATE lighthouse_result 
         SET status = 'FAILED', 
         completed_at = NOW() 
         WHERE id = ?`,
        [resultID]
      );
      hasErrorInLHService = true;
      break;
    }
  }

  if (hasErrorInLHService) {
    await pool.execute(
      `UPDATE lighthouse_job 
       SET status = 'FAILED', 
       completed_at = NOW() 
       WHERE id = ?`,
      [id]
    );
    return res.status(500).json({ message: "Failed to start lighthouse audit in one or more regions" });
  }

  res.status(201).json({
    id
  });
};

const syncJobStatuses = async jobId => {
  const [rows] = await pool.execute(
    "SELECT status FROM lighthouse_result WHERE job_id = ?",
    [jobId]
  );

  if (rows.every(r => r.status === 'COMPLETED')) {
    await pool.execute(
      `UPDATE lighthouse_job 
       SET status = 'COMPLETED', 
       completed_at = NOW() 
       WHERE id = ?`,
      [jobId]
    );
  } else if (rows.some(r => r.status === 'RUNNING')) {
    await pool.execute(
      `UPDATE lighthouse_job 
       SET status = 'RUNNING' 
       WHERE id = ?`,
      [jobId]
    );
  } else if (rows.every(r => r.status === 'FAILED')) {
    await pool.execute(
      `UPDATE lighthouse_job 
       SET status = 'FAILED', 
       completed_at = NOW() 
       WHERE id = ?`,
      [jobId]
    );
  } else {
    // TODO:: what happens if some failed and some completed?
  }
};

const updateResults = async (req, res) => {
  const secret = req.headers['x-lh-secret'];
  const expectedSecret = process.env.LH_WEBHOOK_SECRET;

  if (secret !== expectedSecret) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { result_id, status, region } = req.body;
  if (!result_id || !status) {
    return res.status(400).json({ message: "result_id and status are required" });
  }

  const [resultRows] = await pool.execute(
    "SELECT job_id FROM lighthouse_result WHERE id = ? LIMIT 1",
    [result_id]
  );

  if (resultRows.length === 0) {
    return res.status(404).json({ message: "Lighthouse result not found for the given result_id" });
  }

  const { job_id } = resultRows[0];
  const resultId = result_id;

  switch (status) {
    case 'COMPLETED':
      const {
        s3_report_url,
        s3_metrics_json_url,
        fcp,
        lcp,
        cls,
        tbt,
        tti,
        ttfb,
        performance_score
      } = req.body;

      await pool.execute(
        `UPDATE lighthouse_result
         SET status = 'COMPLETED',
         completed_at = NOW(),
         s3_report_url = ?,
         s3_metrics_json_url = ?,
         fcp = ?,
         lcp = ?,
         cls = ?,
         tbt = ?,
         tti = ?,
         ttfb = ?,
         performance_score = ?
         WHERE id = ?`,
        [
          s3_report_url,
          s3_metrics_json_url,
          fcp,
          lcp,
          cls,
          tbt,
          tti,
          ttfb,
          performance_score,
          resultId
        ]
      );

      await syncJobStatuses(job_id);
      break;
    case 'FAILED':
      // TODO :: error message?
      await pool.execute(
        `UPDATE lighthouse_result 
         SET status = 'FAILED',
         completed_at = NOW()
         WHERE id = ?`,
        [resultId]
      );

      await syncJobStatuses(job_id);
      break;
    case 'RUNNING':
      await pool.execute(
        `UPDATE lighthouse_result 
         SET status = 'RUNNING'
         WHERE job_id = ? AND region = ?`,
        [job_id, region]
      );

      await syncJobStatuses(job_id);
      break;
    default:
      return res.status(400).json({ message: "Invalid status value" });
  }

  res.json({ message: "Lighthouse job updated successfully" });
};

const getAllTestsByUser = async (req, res) => {
  const userId = req.user.id;

  const [jobs] = await pool.execute(
    `SELECT * FROM lighthouse_job WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );

  const jobIds = jobs.map(j => j.id);
  let resultsMap = {};
  if (jobIds.length > 0) {
    const [results] = await pool.execute(
      `SELECT * FROM lighthouse_result WHERE job_id IN (${jobIds.map(() => '?').join(',')})`,
      jobIds
    );
    
    resultsMap = results.reduce((acc, r) => {
      if (!acc[r.job_id]) acc[r.job_id] = [];
      acc[r.job_id].push({
        id: r.id,
        region: r.region,
        status: r.status,
        created_at: r.created_at,
        s3_report_url: r.s3_report_url,
        metrics: {
          lcp: r.lcp,
          fcp: r.fcp,
          cls: r.cls,
          tbt: r.tbt,
          tti: r.tti,
          ttfb: r.ttfb,
          performance_score: r.performance_score
        }
      });
      return acc;
    }, {});
  }
  const response = jobs.map(j => ({
    id: j.id,
    url: j.url,
    device: j.device,
    regions: j.regions,
    ip: j.ip,
    status: j.status,
    created_at: j.created_at,
    completed_at: j.completed_at,
    results: resultsMap[j.id] || []
  }));

  res.json(response ?? []);
};

module.exports = { getResultsById, runNewAudit, updateResults, getAllTestsByUser };
