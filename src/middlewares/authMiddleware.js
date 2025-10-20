const { verifyAccessToken } = require("../auth");

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  // Check for JWT
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = verifyAccessToken(token);
      req.user = { ...decoded, type: 'jwt' };
      return next();
    } catch (err) {
      return res.status(401).json({ error: err });
    }
  }

  return res.status(401).json({ error: 'Invalid authorization format' });
};

module.exports = authenticate;
