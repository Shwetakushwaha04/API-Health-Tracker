require("dotenv").config();

const { getSecret } = require("./src/auth");
const { openDatabase } = require("./src/db");
const { createApp } = require("./src/app");
const { startScheduler } = require("./src/checker");

// Fail early with a clear message if the secret is missing
getSecret();

const PORT = Number(process.env.PORT) || 3000;
const CHECK_INTERVAL_MS = Number(process.env.CHECK_INTERVAL_MS) || 30000;

const db = openDatabase();
const app = createApp(db);

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const timer = startScheduler(db, CHECK_INTERVAL_MS);

// Close cleanly on Ctrl+C
process.on("SIGINT", () => {
  clearInterval(timer);
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
