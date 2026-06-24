const svc      = require('../services/friends.service');
const presence = require('../services/presence.service');

const getFriends    = async (req, res, next) => { try { res.json(await svc.getFriends(req.user.id)); } catch (e) { next(e); } };
const getRequests   = async (req, res, next) => { try { res.json(await svc.getRequests(req.user.id)); } catch (e) { next(e); } };
const searchUsers   = async (req, res, next) => { try { res.json(await svc.searchUsers(req.user.id, req.query.q)); } catch (e) { next(e); } };

const sendRequest = async (req, res, next) => {
  try {
    const addresseeId = parseInt(req.params.userId, 10);
    const friendship  = await svc.sendRequest(req.user.id, addresseeId);
    res.status(201).json(friendship);
    // Notify the addressee in real-time so their bell lights up immediately
    presence.emitToUser(addresseeId, 'friend_request_received', {
      friendshipId: friendship.id,
      requesterId:  req.user.id,
      username:     req.user.username,
    });
  } catch (e) { next(e); }
};

const acceptRequest = async (req, res, next) => { try { res.json(await svc.acceptRequest(req.user.id, parseInt(req.params.id, 10))); } catch (e) { next(e); } };
const rejectRequest = async (req, res, next) => { try { res.json(await svc.rejectRequest(req.user.id, parseInt(req.params.id, 10))); } catch (e) { next(e); } };
const removeFriend  = async (req, res, next) => { try { await svc.removeFriend(req.user.id, parseInt(req.params.id, 10)); res.status(204).end(); } catch (e) { next(e); } };

module.exports = { getFriends, getRequests, searchUsers, sendRequest, acceptRequest, rejectRequest, removeFriend };
