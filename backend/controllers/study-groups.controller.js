const svc = require('../services/study-groups.service');

const createGroup = async (req, res, next) => {
  try {
    const group = await svc.createGroup(req.user.id, req.body.name, req.body.member_ids);
    res.status(201).json(group);
  } catch (e) { next(e); }
};

const listMyGroups = async (req, res, next) => {
  try { res.json(await svc.listMyGroups(req.user.id)); } catch (e) { next(e); }
};

const addMember = async (req, res, next) => {
  try {
    await svc.addMember(req.user.id, parseInt(req.params.id, 10), parseInt(req.body.user_id, 10));
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
};

const removeMember = async (req, res, next) => {
  try {
    await svc.removeMember(req.user.id, parseInt(req.params.id, 10), parseInt(req.params.userId, 10));
    res.status(204).end();
  } catch (e) { next(e); }
};

const deleteGroup = async (req, res, next) => {
  try {
    await svc.deleteGroup(req.user.id, parseInt(req.params.id, 10));
    res.status(204).end();
  } catch (e) { next(e); }
};

const leaveGroup = async (req, res, next) => {
  try {
    await svc.leaveGroup(req.user.id, parseInt(req.params.id, 10));
    res.status(204).end();
  } catch (e) { next(e); }
};

const getLeaderboard = async (req, res, next) => {
  try { res.json(await svc.getLeaderboard(req.user.id, parseInt(req.params.id, 10))); } catch (e) { next(e); }
};

module.exports = { createGroup, listMyGroups, addMember, removeMember, deleteGroup, leaveGroup, getLeaderboard };
