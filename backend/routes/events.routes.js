const express = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/events.controller');

const router = express.Router();
router.use(auth);
router.get('/test-email', ctrl.testEmail);
router.get('/', ctrl.getAll);
router.post('/', ctrl.create);
router.delete('/:id', ctrl.remove);

module.exports = router;
