const svc = require('../services/sessions.service');

const startSession = (req, res, next) => { try { res.status(201).json(svc.start(req.user.id, req.body)); } catch (e) { next(e); } };
const stopSession = (req, res, next) => { try { res.json(svc.stop(req.user.id, req.params.id)); } catch (e) { next(e); } };
const manualEntry = (req, res, next) => { try { res.status(201).json(svc.manual(req.user.id, req.body)); } catch (e) { next(e); } };
const getAll = (req, res, next) => { try { res.json(svc.getAll(req.user.id, req.query)); } catch (e) { next(e); } };
const remove = (req, res, next) => { try { svc.remove(req.user.id, req.params.id); res.status(204).end(); } catch (e) { next(e); } };

module.exports = { startSession, stopSession, manualEntry, getAll, remove };
