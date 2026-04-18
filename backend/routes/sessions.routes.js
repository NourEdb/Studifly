const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../utils/validators');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/sessions.controller');

router.use(auth);

router.post('/start', ctrl.startSession);
router.patch('/:id/stop', ctrl.stopSession);
router.post('/manual',
  body('start_time').isISO8601(),
  validate,
  ctrl.manualEntry
);
router.get('/', ctrl.getAll);
router.delete('/:id', ctrl.remove);

module.exports = router;
