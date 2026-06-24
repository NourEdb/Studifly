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
  body('plan_date').matches(/^\d{4}-\d{2}-\d{2}$/),
  body('start_time').matches(/^\d{2}:\d{2}$/),
  body('end_time').matches(/^\d{2}:\d{2}$/),
  validate,
  ctrl.create
);

router.put('/:id',
  body('plan_date').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  body('start_time').optional().matches(/^\d{2}:\d{2}$/),
  body('end_time').optional().matches(/^\d{2}:\d{2}$/),
  validate,
  ctrl.update
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
