const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../utils/validators');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/auth.controller');

router.post('/register',
  body('username').trim().isLength({ min: 2, max: 30 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  validate,
  ctrl.registerHandler
);

router.post('/login',
  body('username').notEmpty(),
  body('password').notEmpty(),
  validate,
  ctrl.loginHandler
);

router.get('/me', auth, ctrl.meHandler);
router.put('/me', auth, ctrl.updateMeHandler);

module.exports = router;
