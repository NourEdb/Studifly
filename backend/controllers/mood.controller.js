const svc = require('../services/mood.service');

const submitCheckin  = async (req, res, next) => { try { res.status(201).json(await svc.submitCheckin(req.user.id, req.body)); } catch (e) { next(e); } };
const getCheckins    = async (req, res, next) => { try { res.json(await svc.getCheckins(req.user.id));    } catch (e) { next(e); } };
const getTodayCheckin = async (req, res, next) => { try { res.json(await svc.getTodayCheckin(req.user.id)); } catch (e) { next(e); } };
const getCorrelation  = async (req, res, next) => { try { res.json(await svc.getCorrelation(req.user.id));  } catch (e) { next(e); } };

module.exports = { submitCheckin, getCheckins, getTodayCheckin, getCorrelation };
