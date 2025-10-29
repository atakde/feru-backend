const { verifyAccessToken } = require("../auth");

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const decoded = verifyAccessToken(token);
      req.user = { ...decoded, type: "jwt" };
    } catch (err) {
      req.user = null;
    }
  } else {
    req.user = null;
  }

  next();
};

module.exports = authenticate;
