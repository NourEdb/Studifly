const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../utils/validators');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/study-blocks.controller');

router.use(auth);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);

router.post('/',
  body('task_id').isInt({ min: 1 }),
  body('plan_date').optional({ nullable: true }).matches(/^\d{4}-\d{2}-\d{2}$/),
  body('start_time').optional({ nullable: true }).matches(/^\d{2}:\d{2}$/),
  body('end_time').optional({ nullable: true }).matches(/^\d{2}:\d{2}$/),
  body('planned_time').optional({ nullable: true }).isInt({ min: 0 }),
  // A block can be entirely unscheduled (a plain subtask), but it can't have
  // only one of start/end, and a time without a date makes no sense.
  body().custom(b => {
    if (Boolean(b.start_time) !== Boolean(b.end_time)) {
      throw new Error('start_time and end_time must be provided together');
    }
    if ((b.start_time || b.end_time) && !b.plan_date) {
      throw new Error('A date is required when a time is set');
    }
    return true;
  }),
  validate,
  ctrl.create
);

router.put('/:id',
  body('plan_date').optional({ nullable: true }).matches(/^\d{4}-\d{2}-\d{2}$/),
  body('start_time').optional({ nullable: true }).matches(/^\d{2}:\d{2}$/),
  body('end_time').optional({ nullable: true }).matches(/^\d{2}:\d{2}$/),
  body('planned_time').optional({ nullable: true }).isInt({ min: 0 }),
  validate,
  ctrl.update
);

router.patch('/:id/status',
  body('status').isIn(['pending', 'in_progress', 'completed']),
  validate,
  ctrl.updateStatus
);

router.delete('/:id', ctrl.remove);

router.patch('/:id/actual',
  body('actual_start').optional({ nullable: true }).matches(/^\d{2}:\d{2}$/),
  body('actual_end').optional({ nullable: true }).matches(/^\d{2}:\d{2}$/),
  body('completion_pct').optional({ nullable: true }).isInt({ min: 0, max: 100 }),
  validate,
  ctrl.logActual
);

module.exports = router;
