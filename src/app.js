const express = require('express');
const errorMiddleware = require('./middlewares/errorMiddleware');
const notFoundMiddleware = require('./middlewares/notFoundMiddleware');
const authRoutes = require("./routes/auth");
const lighthouseRoutes = require("./routes/lighthouse");

const app = express();
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/lighthouse', lighthouseRoutes);

// Middlewares
app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
