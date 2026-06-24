const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/ai-coach.controller');

router.use(auth);

router.get('/context',  ctrl.getContext);
router.get('/history',  ctrl.getHistory);
router.post('/chat',    ctrl.chat);
router.delete('/history',        ctrl.clearHistory);
router.post('/course-insight',   ctrl.courseInsight);

module.exports = router;
