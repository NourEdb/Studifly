const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../utils/validators');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/sessions.controller');

router.use(auth);

router.post('/start',
  body('task_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('study_block_id').optional({ nullable: true }).isInt({ min: 1 }),
  validate,
  ctrl.startSession
);
router.patch('/:id/stop',
  body('break_seconds').optional({ nullable: true }).isInt({ min: 0 }),
  validate,
  ctrl.stopSession
);
router.patch('/:id/reflect', ctrl.reflectSession);
router.post('/manual',
  body('start_time').isISO8601(),
  body('task_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('study_block_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('completion_answer').optional({ nullable: true }).isIn(['yes', 'partially', 'no']),
  validate,
  ctrl.manualEntry
);
router.get('/', ctrl.getAll);
router.get('/task-total', ctrl.getTaskTotal);
router.delete('/:id', ctrl.remove);

module.exports = router;
