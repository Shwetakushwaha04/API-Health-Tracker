const path = require("path");
const express = require("express");

const createAuthRouter = require("./routes/authRoutes");
const createApiRouter = require("./routes/apiRoutes");

// Builds the Express app. The database is passed in so tests can use an
// in-memory one. Nothing here starts a server or a timer.
function createApp(db) {
  const app = express();

  app.use(express.json({ limit: "10kb" }));
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("/health", (req, res) => res.json({ status: "ok" }));

  app.use("/", createAuthRouter(db));
  app.use("/api", createApiRouter(db));

  // Unknown API routes -> JSON 404
  app.use("/api", (req, res) => {
    res.status(404).json({ message: "Route not found" });
  });

  // Last-resort error handler (also catches bad JSON bodies)
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ message: "Invalid JSON body" });
    }

    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  });

  return app;
}

module.exports = { createApp };
