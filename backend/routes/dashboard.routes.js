const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/dashboard.controller');

router.use(auth);

router.get('/summary', ctrl.summary);
router.get('/weekly-hours', ctrl.weeklyHours);
router.get('/by-course', ctrl.byCourse);

module.exports = router;
