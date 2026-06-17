const svc = require('../services/tasks.service');

const getAll               = async (req, res, next) => { try { res.json(await svc.getAll(req.user.id, req.query)); } catch (e) { next(e); } };
const getOne               = async (req, res, next) => { try { res.json(await svc.getOne(req.user.id, req.params.id)); } catch (e) { next(e); } };
const getCustomActivityTypes = async (req, res, next) => { try { res.json(await svc.getCustomActivityTypes(req.user.id)); } catch (e) { next(e); } };
const create = async (req, res, next) => { try { res.status(201).json(await svc.create(req.user.id, req.body)); } catch (e) { next(e); } };
const update = async (req, res, next) => { try { res.json(await svc.update(req.user.id, req.params.id, req.body)); } catch (e) { next(e); } };
const remove = async (req, res, next) => { try { await svc.remove(req.user.id, req.params.id); res.status(204).end(); } catch (e) { next(e); } };

module.exports = { getAll, getOne, getCustomActivityTypes, create, update, remove };
