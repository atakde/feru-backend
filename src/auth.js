const jwt = require("jsonwebtoken");
const { SECRET, REFRESH_SECRET } = process.env;

const generateAccessToken = user => {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    SECRET,
    { expiresIn: "60m" }
  );
}

const generateRefreshToken = user => {
  return jwt.sign({ id: user.id }, REFRESH_SECRET, { expiresIn: "7d" });
}

const verifyAccessToken = token => {
  return jwt.verify(token, SECRET);
}

const verifyRefreshToken = token => {
  return jwt.verify(token, REFRESH_SECRET);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};
