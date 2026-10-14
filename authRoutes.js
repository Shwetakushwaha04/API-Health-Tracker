const express = require("express");

const { hashPassword, comparePassword, createToken } = require("./auth");

const router = express.Router();

// Temporary in-memory users
let users = [];

// Register
router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      message: "Username and password are required",
    });
  }

  const existingUser = users.find((user) => user.username === username);

  if (existingUser) {
    return res.status(409).json({
      message: "Username already exists",
    });
  }

  const hashedPassword = await hashPassword(password);

  const newUser = {
    id: Date.now(),
    username: username,
    password: hashedPassword,
  };

  users.push(newUser);

  res.status(201).json({
    message: "User registered successfully",
  });
});

// Login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = users.find((user) => user.username === username);

  if (!user) {
    return res.status(401).json({
      message: "Invalid username or password",
    });
  }

  const passwordMatch = await comparePassword(password, user.password);

  if (!passwordMatch) {
    return res.status(401).json({
      message: "Invalid username or password",
    });
  }

  const token = createToken(user);

  res.json({
    message: "Login successful",
    token: token,
  });
});

module.exports = router;
