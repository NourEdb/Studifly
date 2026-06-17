const svc = require('../services/export.service');

function sendCsv(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv || '');
}

const courses  = async (req, res, next) => { try { sendCsv(res, 'studifly-courses.csv',  await svc.exportCourses(req.user.id));  } catch (e) { next(e); } };
const tasks    = async (req, res, next) => { try { sendCsv(res, 'studifly-tasks.csv',    await svc.exportTasks(req.user.id));    } catch (e) { next(e); } };
const sessions = async (req, res, next) => { try { sendCsv(res, 'studifly-sessions.csv', await svc.exportSessions(req.user.id)); } catch (e) { next(e); } };
const events   = async (req, res, next) => { try { sendCsv(res, 'studifly-events.csv',   await svc.exportEvents(req.user.id));   } catch (e) { next(e); } };

module.exports = { courses, tasks, sessions, events };
