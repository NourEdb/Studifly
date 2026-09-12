const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../utils/validators');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/tasks.controller');

router.use(auth);

router.get('/custom-activity-types', ctrl.getCustomActivityTypes);
router.get('/', ctrl.getAll);
router.post('/',
  body('name').trim().notEmpty(),
  body('activity_type').trim().notEmpty(),
  body('category').optional({ nullable: true }).isIn(['exam', 'homework', 'project', 'other']),
  validate,
  ctrl.create
);
router.patch('/reorder',
  body('ids').isArray({ min: 1 }),
  body('ids.*').isInt({ min: 1 }),
  validate,
  ctrl.reorder
);
router.patch('/reset-order', ctrl.resetOrder);
router.get('/:id', ctrl.getOne);
router.put('/:id',
  body('category').optional({ nullable: true }).isIn(['exam', 'homework', 'project', 'other']),
  validate,
  ctrl.update
);
router.patch('/:id/status',
  body('status').isIn(['pending', 'in_progress', 'completed']),
  validate,
  ctrl.updateStatus
);
router.delete('/:id', ctrl.remove);

module.exports = router;
