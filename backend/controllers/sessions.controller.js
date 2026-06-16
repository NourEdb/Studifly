const svc = require('../services/sessions.service');

const startSession   = async (req, res, next) => { try { res.status(201).json(await svc.start(req.user.id, req.body)); } catch (e) { next(e); } };
const stopSession    = async (req, res, next) => { try { res.json(await svc.stop(req.user.id, req.params.id)); } catch (e) { next(e); } };
const reflectSession = async (req, res, next) => { try { res.json(await svc.reflect(req.user.id, req.params.id, req.body)); } catch (e) { next(e); } };
const manualEntry    = async (req, res, next) => { try { res.status(201).json(await svc.manual(req.user.id, req.body)); } catch (e) { next(e); } };
const getAll         = async (req, res, next) => { try { res.json(await svc.getAll(req.user.id, req.query)); } catch (e) { next(e); } };
const getTaskTotal   = async (req, res, next) => { try { res.json(await svc.getTaskTotal(req.user.id, req.query.task_id)); } catch (e) { next(e); } };
const remove         = async (req, res, next) => { try { await svc.remove(req.user.id, req.params.id); res.status(204).end(); } catch (e) { next(e); } };

module.exports = { startSession, stopSession, reflectSession, manualEntry, getAll, getTaskTotal, remove };
