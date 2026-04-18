const svc = require('../services/tasks.service');

const getAll = (req, res, next) => { try { res.json(svc.getAll(req.user.id, req.query)); } catch (e) { next(e); } };
const getOne = (req, res, next) => { try { res.json(svc.getOne(req.user.id, req.params.id)); } catch (e) { next(e); } };
const create = (req, res, next) => { try { res.status(201).json(svc.create(req.user.id, req.body)); } catch (e) { next(e); } };
const update = (req, res, next) => { try { res.json(svc.update(req.user.id, req.params.id, req.body)); } catch (e) { next(e); } };
const updateStatus = (req, res, next) => { try { res.json(svc.updateStatus(req.user.id, req.params.id, req.body.status)); } catch (e) { next(e); } };
const remove = (req, res, next) => { try { svc.remove(req.user.id, req.params.id); res.status(204).end(); } catch (e) { next(e); } };

module.exports = { getAll, getOne, create, update, updateStatus, remove };
