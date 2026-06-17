const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/export.controller');

router.use(auth);
router.get('/csv/courses',  ctrl.courses);
router.get('/csv/tasks',    ctrl.tasks);
router.get('/csv/sessions', ctrl.sessions);
router.get('/csv/events',   ctrl.events);

module.exports = router;
