const axios = require("axios");
const { checkResolvedHost } = require("./urlGuard");

const REQUEST_TIMEOUT_MS = 5000;
const MAX_CHECKS_PER_API = 200; // older results are deleted
const CONCURRENCY = 5; // how many APIs are pinged at the same time

// Pings one API, stores the result in the database and returns the new status.
async function checkApiHealth(db, api) {
  const startTime = Date.now();
  let statusCode = null;
  let healthy = false;

  const blocked = await checkResolvedHost(api.url);

  if (!blocked) {
    try {
      const response = await axios.get(api.url, {
        timeout: REQUEST_TIMEOUT_MS,
        maxRedirects: 0, // a redirect could point somewhere private
        validateStatus: () => true, // we decide what counts as healthy
        headers: {
          "User-Agent": "API-Health-Tracker",
          Accept: "application/json, text/html, */*",
        },
      });

      statusCode = response.status;
      healthy = response.status >= 200 && response.status < 400;
    } catch (error) {
      // timeout, DNS failure, connection refused, ...
      console.log(`${api.name} failed: ${error.code || error.message}`);
    }
  } else {
    console.log(`${api.name} skipped: ${blocked}`);
  }

  const responseTime = Date.now() - startTime;
  const checkedAt = new Date().toISOString();
  const status = healthy ? "Healthy" : "Down";

  // Record the check and update the API row together.
  db.transaction(() => {
    db.prepare(
      `INSERT INTO checks (api_id, checked_at, status_code, response_time, healthy)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(api.id, checkedAt, statusCode, responseTime, healthy ? 1 : 0);

    db.prepare(
      `UPDATE apis
       SET status = ?, status_code = ?, response_time = ?, last_checked = ?
       WHERE id = ?`,
    ).run(status, statusCode, responseTime, checkedAt, api.id);

    // keep the checks table from growing forever
    db.prepare(
      `DELETE FROM checks
       WHERE api_id = ? AND id NOT IN (
         SELECT id FROM checks WHERE api_id = ? ORDER BY id DESC LIMIT ?
       )`,
    ).run(api.id, api.id, MAX_CHECKS_PER_API);
  })();

  return { status, statusCode, responseTime, lastChecked: checkedAt };
}

// Checks every API in the database, a few at a time.
async function checkAllApis(db) {
  const apis = db.prepare("SELECT id, name, url FROM apis").all();

  for (let i = 0; i < apis.length; i += CONCURRENCY) {
    const batch = apis.slice(i, i + CONCURRENCY);
    await Promise.allSettled(batch.map((api) => checkApiHealth(db, api)));
  }

  return apis.length;
}

// Runs checkAllApis on a timer. A new round never starts while the
// previous one is still running.
function startScheduler(db, intervalMs) {
  let running = false;

  async function runRound() {
    if (running) return;
    running = true;

    try {
      const count = await checkAllApis(db);
      console.log(`[${new Date().toISOString()}] Checked ${count} API(s)`);
    } catch (error) {
      console.error("Scheduled check failed:", error.message);
    } finally {
      running = false;
    }
  }

  runRound();
  return setInterval(runRound, intervalMs);
}

module.exports = { checkApiHealth, checkAllApis, startScheduler };
