const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/gamification.controller');

router.use(auth);

router.get('/profile', ctrl.getProfile);

module.exports = router;
