const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const PORT = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';
const protocol = process.env.PROTOCOL || 'http';
const runningUrl = `${protocol}://${host}:${PORT}`;

app.listen(PORT, () => {
  console.log(`Server running on ${runningUrl}`);
});
