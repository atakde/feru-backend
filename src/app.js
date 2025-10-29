const express = require('express');
const cors = require('cors')
const errorMiddleware = require('./middlewares/errorMiddleware');
const notFoundMiddleware = require('./middlewares/notFoundMiddleware');
const authenticate = require('./middlewares/authMiddleware');
const authRoutes = require("./routes/auth");
const lighthouseRoutes = require("./routes/lighthouse");
const monitorRoutes = require("./routes/monitoring");

const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(authenticate);
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'https://feru.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
// Routes
app.use('/auth', authRoutes);
app.use('/lighthouse', lighthouseRoutes);
app.use('/monitoring', monitorRoutes);

// Middlewares
app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
