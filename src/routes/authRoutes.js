const express = require("express");
const rateLimit = require("express-rate-limit");

const { hashPassword, comparePassword, createToken } = require("../auth");

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/;
const MIN_PASSWORD_LENGTH = 8;

// Example APIs every new account starts with
const STARTER_APIS = [
  { name: "PokeAPI", url: "https://pokeapi.co/" },
  { name: "GitHub API", url: "https://api.github.com/" },
];

function createAuthRouter(db) {
  const router = express.Router();

  // Slows down password guessing
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.AUTH_RATE_LIMIT) || 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many attempts. Please try again later." },
  });

  router.post("/register", limiter, async (req, res) => {
    const { username, password } = req.body || {};

    if (typeof username !== "string" || !USERNAME_PATTERN.test(username)) {
      return res.status(400).json({
        message: "Username must be 3-30 characters: letters, numbers or _",
      });
    }

    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    const existing = db
      .prepare("SELECT id FROM users WHERE username = ?")
      .get(username);

    if (existing) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const passwordHash = await hashPassword(password);

    const result = db
      .prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
      .run(username, passwordHash);

    const insertApi = db.prepare(
      "INSERT INTO apis (user_id, name, url) VALUES (?, ?, ?)",
    );

    for (const api of STARTER_APIS) {
      insertApi.run(result.lastInsertRowid, api.name, api.url);
    }

    res.status(201).json({ message: "User registered successfully" });
  });

  router.post("/login", limiter, async (req, res) => {
    const { username, password } = req.body || {};

    if (typeof username !== "string" || typeof password !== "string") {
      return res
        .status(400)
        .json({ message: "Username and password are required" });
    }

    const user = db
      .prepare("SELECT id, username, password_hash FROM users WHERE username = ?")
      .get(username);

    // Same message for "no such user" and "wrong password"
    if (!user || !(await comparePassword(password, user.password_hash))) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    res.json({ message: "Login successful", token: createToken(user) });
  });

  return router;
}

module.exports = createAuthRouter;
