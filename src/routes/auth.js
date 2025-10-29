const express = require("express");
const router = express.Router();
const { me, refresh, register, login } = require("../controllers/authController");
const requireAuth = require("../middlewares/requireAuthMiddleware");

// Protected route
router.get("/me", requireAuth, me);

// Public routes
router.post("/refresh", refresh);
router.post("/register", register);
router.post("/login", login);

module.exports = router;
