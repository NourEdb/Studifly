const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { sendWeeklyReviewToUser } = require('../services/weekly-review.service');

// POST /api/email/weekly-review  — send immediately to the authenticated user (testing)
router.post('/weekly-review', auth, async (req, res) => {
  try {
    await sendWeeklyReviewToUser(req.user.id);
    res.json({ ok: true, message: 'Weekly review sent — check your inbox!' });
  } catch (err) {
    console.error('[POST /api/email/weekly-review]', err.message);
    res.status(500).json({ error: err.message || 'Failed to send weekly review' });
  }
});

module.exports = router;
