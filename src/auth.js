const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Read lazily so tests can set the variable before the first call.
function getSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not set. Copy .env.example to .env first.");
  }

  return secret;
}

function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

function comparePassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

function createToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, getSecret(), {
    expiresIn: "1h",
  });
}

// Express middleware: expects "Authorization: Bearer <token>"
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Access token required" });
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Invalid authorization format" });
  }

  try {
    req.user = jwt.verify(token, getSecret());
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

module.exports = {
  getSecret,
  hashPassword,
  comparePassword,
  createToken,
  authenticateToken,
};
