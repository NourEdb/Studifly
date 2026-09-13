const router = require('express').Router();
const auth   = require('../middleware/auth');
const ctrl   = require('../controllers/study-groups.controller');

router.use(auth);

router.get('/',                       ctrl.listMyGroups);
router.post('/',                      ctrl.createGroup);
router.get('/:id/leaderboard',        ctrl.getLeaderboard);
router.post('/:id/members',           ctrl.addMember);
router.delete('/:id/members/:userId', ctrl.removeMember);
router.delete('/:id',                 ctrl.deleteGroup);
router.post('/:id/leave',             ctrl.leaveGroup);

module.exports = router;
