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

router.put('/change-password', auth,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
  validate,
  ctrl.changePasswordHandler
);

router.delete('/me', auth, ctrl.deleteAccountHandler);

router.post('/forgot-password',
  body('email').isEmail().normalizeEmail(),
  validate,
  ctrl.forgotPasswordHandler
);

router.post('/reset-password',
  body('token').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
  validate,
  ctrl.resetPasswordHandler
);

module.exports = router;
