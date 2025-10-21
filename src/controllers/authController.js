
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, verifyAccessToken } = require('../auth');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const pool = require('../db');

const me = (req, res) => {
  const bearer = req.headers.authorization;
  if (!bearer || !bearer.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = bearer.substring(7);

  try {
    const decoded = verifyAccessToken(token);
    return res.json({ user: decoded });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: err.message });
  }
};

const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ error: "Missing refresh token" });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const [rows] = await pool.execute(
      "SELECT * FROM users WHERE id = ?",
      [decoded.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = rows[0];
    const newAccessToken = generateAccessToken({ id: user.id, email: user.email, name: user.name });
    const newRefreshToken = generateRefreshToken({ id: user.id, email: user.email, name: user.name });
    return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
};

const register = async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }

  try {
    const existing = await pool.execute(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existing[0].length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await pool.execute(
      "INSERT INTO users (id, email, name, password_hash, user_type, status) VALUES (?, ?, ?, ?, 'FREE', 'ACTIVE')",
      [userId, email, name, passwordHash]
    );

    const user = { id: userId, email, name };
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return res.json({
      user,
      tokens: {
        accessToken,
        refreshToken
      }
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const result = await pool.execute(
      "SELECT id, email, name, password_hash, user_type, status FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (result[0].length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = result[0][0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        user_type: user.user_type
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  me,
  refresh,
  login,
  register
};
