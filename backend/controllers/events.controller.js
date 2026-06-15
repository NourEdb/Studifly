const svc = require('../services/events.service');

const getAll = async (req, res, next) => { try { res.json(await svc.getAll(req.user.id)); } catch (e) { next(e); } };
const create = async (req, res, next) => { try { res.status(201).json(await svc.create(req.user.id, req.body)); } catch (e) { next(e); } };
const remove = async (req, res, next) => { try { await svc.remove(req.user.id, req.params.id); res.status(204).end(); } catch (e) { next(e); } };

module.exports = { getAll, create, remove };
