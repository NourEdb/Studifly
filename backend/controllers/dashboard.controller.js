const svc     = require('../services/dashboard.service');
const predSvc = require('../services/prediction.service');

const summary     = async (req, res, next) => { try { res.json(await svc.getSummary(req.user.id, req.query.tz || 'UTC')); } catch (e) { next(e); } };
const weeklyHours = async (req, res, next) => { try { res.json(await svc.getWeeklyHours(req.user.id, parseInt(req.query.weeks) || 4)); } catch (e) { next(e); } };
const byCourse    = async (req, res, next) => { try { res.json(await svc.getByCourse(req.user.id)); } catch (e) { next(e); } };
const heatmap          = async (req, res, next) => { try { res.json(await svc.getHeatmap(req.user.id)); } catch (e) { next(e); } };
const courseComparison = async (req, res, next) => { try { res.json(await svc.getCourseComparison(req.user.id)); } catch (e) { next(e); } };

const prediction = async (req, res, next) => { try { res.json(await predSvc.getTaskPredictions(req.user.id)); } catch (e) { next(e); } };

module.exports = { summary, weeklyHours, byCourse, heatmap, courseComparison, prediction };
