const express = require("express");

const { authenticateToken } = require("../auth");
const { checkApiHealth } = require("../checker");
const { validateUrlFormat } = require("../urlGuard");

const MAX_APIS_PER_USER = 20;
const HISTORY_POINTS = 20; // checks sent to the chart / history view
const UPTIME_WINDOW = 100; // uptime % is based on the last N checks

// Turns a database row into the JSON the frontend uses
function formatApi(db, row) {
  const recent = db
    .prepare(
      `SELECT checked_at, status_code, response_time, healthy
       FROM checks WHERE api_id = ? ORDER BY id DESC LIMIT ?`,
    )
    .all(row.id, UPTIME_WINDOW);

  const uptime = recent.length
    ? Math.round(
        (recent.filter((check) => check.healthy).length / recent.length) * 1000,
      ) / 10
    : null;

  // newest first from the query -> oldest first for the chart
  const history = recent
    .slice(0, HISTORY_POINTS)
    .reverse()
    .map((check) => ({
      time: check.checked_at,
      statusCode: check.status_code,
      responseTime: check.response_time,
      healthy: Boolean(check.healthy),
    }));

  return {
    id: row.id,
    name: row.name,
    url: row.url,
    status: row.status,
    statusCode: row.status_code,
    responseTime: row.response_time,
    lastChecked: row.last_checked,
    uptime,
    history,
  };
}

function createApiRouter(db) {
  const router = express.Router();

  router.use(authenticateToken);

  const findOwnedApi = (id, userId) =>
    db.prepare("SELECT * FROM apis WHERE id = ? AND user_id = ?").get(id, userId);

  // GET /api - list the logged-in user's APIs
  router.get("/", (req, res) => {
    const rows = db
      .prepare("SELECT * FROM apis WHERE user_id = ? ORDER BY id")
      .all(req.user.id);

    res.json(rows.map((row) => formatApi(db, row)));
  });

  // POST /api - add an API
  router.post("/", (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";

    if (!name || !url) {
      return res.status(400).json({ message: "Name and URL are required" });
    }

    if (name.length > 60) {
      return res.status(400).json({ message: "Name is too long (max 60)" });
    }

    if (url.length > 2000) {
      return res.status(400).json({ message: "URL is too long" });
    }

    const urlError = validateUrlFormat(url);

    if (urlError) {
      return res.status(400).json({ message: urlError });
    }

    const { count } = db
      .prepare("SELECT COUNT(*) AS count FROM apis WHERE user_id = ?")
      .get(req.user.id);

    if (count >= MAX_APIS_PER_USER) {
      return res.status(400).json({
        message: `You can monitor up to ${MAX_APIS_PER_USER} APIs`,
      });
    }

    const result = db
      .prepare("INSERT INTO apis (user_id, name, url) VALUES (?, ?, ?)")
      .run(req.user.id, name, url);

    const row = db
      .prepare("SELECT * FROM apis WHERE id = ?")
      .get(result.lastInsertRowid);

    res.status(201).json(formatApi(db, row));
  });

  // POST /api/:id/check - run a health check right now
  router.post("/:id/check", async (req, res) => {
    const api = findOwnedApi(Number(req.params.id), req.user.id);

    if (!api) {
      return res.status(404).json({ message: "API not found" });
    }

    await checkApiHealth(db, api);

    res.json(formatApi(db, findOwnedApi(api.id, req.user.id)));
  });

  // DELETE /api/:id
  router.delete("/:id", (req, res) => {
    const api = findOwnedApi(Number(req.params.id), req.user.id);

    if (!api) {
      return res.status(404).json({ message: "API not found" });
    }

    db.prepare("DELETE FROM apis WHERE id = ?").run(api.id);

    res.json({ message: "API deleted successfully" });
  });

  return router;
}

module.exports = createApiRouter;
