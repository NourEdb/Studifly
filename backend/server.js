require('dotenv').config();
const app = require('./app');
const { initDb } = require('./database/db');
const { startReminderJob }      = require('./jobs/reminder.job');
const { startWeeklyReviewJob }  = require('./jobs/weekly-review.job');

const PORT = process.env.PORT || 5000;

async function start() {
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    console.log(`GROQ_API_KEY loaded (${groqKey.length} chars, starts with "${groqKey.slice(0, 8)}...")`);
  } else {
    console.warn('GROQ_API_KEY is NOT set — AI Coach chat will fail');
  }

  await initDb();
  startReminderJob();
  startWeeklyReviewJob();
  app.listen(PORT, () => {
    console.log(`Studifly backend running on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
