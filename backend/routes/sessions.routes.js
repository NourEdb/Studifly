const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../utils/validators');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/sessions.controller');

router.use(auth);

router.post('/start', ctrl.startSession);
router.patch('/:id/stop',
  body('break_seconds').optional({ nullable: true }).isInt({ min: 0 }),
  validate,
  ctrl.stopSession
);
router.patch('/:id/reflect', ctrl.reflectSession);
router.post('/manual',
  body('start_time').isISO8601(),
  body('completion_answer').optional({ nullable: true }).isIn(['yes', 'partially', 'no']),
  validate,
  ctrl.manualEntry
);
router.get('/', ctrl.getAll);
router.get('/task-total', ctrl.getTaskTotal);
router.delete('/:id', ctrl.remove);

module.exports = router;
