const svc = require('../services/ai-coach.service');

const getContext = async (req, res, next) => {
  try {
    res.json(await svc.getContext(req.user.id));
  } catch (e) {
    next(e);
  }
};

const getHistory = async (req, res, next) => {
  try {
    const messages = await svc.getHistory(req.user.id);
    res.json({ messages });
  } catch (e) {
    next(e);
  }
};

const chat = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message string required' });
    }
    res.json(await svc.chat(req.user.id, message.trim()));
  } catch (e) {
    console.error('[AI Coach] chat failed:');
    console.error('  message :', e.message);
    console.error('  status  :', e.status ?? e.statusCode ?? '—');
    console.error('  details :', e.errorDetails ?? e.response?.data ?? '—');
    console.error('  stack   :', e.stack);
    next(e);
  }
};

const clearHistory = async (req, res, next) => {
  try {
    res.json(await svc.clearHistory(req.user.id));
  } catch (e) {
    next(e);
  }
};

const courseInsight = async (req, res, next) => {
  try {
    const { course_name, stats, task_names } = req.body;
    if (!course_name) return res.status(400).json({ error: 'course_name required' });
    res.json(await svc.getCourseInsight(req.user.id, { course_name, stats, task_names }));
  } catch (e) {
    next(e);
  }
};

module.exports = { getContext, getHistory, chat, clearHistory, courseInsight };
