require('dotenv').config();
const app = require('./app');
const { initDb } = require('./database/db');

const PORT = process.env.PORT || 5000;

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Studifly backend running on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
