const jwt = require("jsonwebtoken");
const { JWT_SECRET, JWT_REFRESH_SECRET } = process.env;

const generateAccessToken = user => {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, user_type: user.user_type },
    JWT_SECRET,
    { expiresIn: "60m" }
  );
}

const generateRefreshToken = user => {
  return jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

const verifyAccessToken = token => {
  return jwt.verify(token, JWT_SECRET);
}

const verifyRefreshToken = token => {
  return jwt.verify(token, JWT_REFRESH_SECRET);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};
