const router = require('express').Router();
const auth   = require('../middleware/auth');
const ctrl   = require('../controllers/friends.controller');

router.use(auth);

router.get('/',                   ctrl.getFriends);
router.get('/requests',           ctrl.getRequests);
router.get('/search',             ctrl.searchUsers);
router.post('/request/:userId',   ctrl.sendRequest);
router.patch('/:id/accept',       ctrl.acceptRequest);
router.patch('/:id/reject',       ctrl.rejectRequest);
router.delete('/:id',             ctrl.removeFriend);

module.exports = router;
