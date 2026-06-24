const router = require('express').Router();
const auth   = require('../middleware/auth');
const ctrl   = require('../controllers/mood.controller');

router.use(auth);

router.post('/',            ctrl.submitCheckin);
router.get('/today',        ctrl.getTodayCheckin);
router.get('/correlation',  ctrl.getCorrelation);
router.get('/',             ctrl.getCheckins);

module.exports = router;
