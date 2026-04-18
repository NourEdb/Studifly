const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../utils/validators');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/courses.controller');

router.use(auth);

router.get('/', ctrl.getAll);
router.post('/', body('name').trim().notEmpty(), validate, ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.get('/:id/tasks', ctrl.getTasks);

module.exports = router;
