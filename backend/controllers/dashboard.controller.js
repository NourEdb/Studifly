const svc = require('../services/dashboard.service');

const summary = async (req, res, next) => { try { res.json(await svc.getSummary(req.user.id)); } catch (e) { next(e); } };
const weeklyHours = async (req, res, next) => { try { res.json(await svc.getWeeklyHours(req.user.id, parseInt(req.query.weeks) || 4)); } catch (e) { next(e); } };
const byCourse = async (req, res, next) => { try { res.json(await svc.getByCourse(req.user.id)); } catch (e) { next(e); } };

module.exports = { summary, weeklyHours, byCourse };
