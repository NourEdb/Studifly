const svc = require('../services/dashboard.service');

const summary = (req, res, next) => { try { res.json(svc.getSummary(req.user.id)); } catch (e) { next(e); } };
const weeklyHours = (req, res, next) => { try { res.json(svc.getWeeklyHours(req.user.id, parseInt(req.query.weeks) || 4)); } catch (e) { next(e); } };
const byCourse = (req, res, next) => { try { res.json(svc.getByCourse(req.user.id)); } catch (e) { next(e); } };

module.exports = { summary, weeklyHours, byCourse };
