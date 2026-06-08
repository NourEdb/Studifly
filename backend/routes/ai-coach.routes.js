const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/ai-coach.controller');

router.use(auth);

router.get('/context', ctrl.getContext);
router.post('/chat', ctrl.chat);

module.exports = router;
