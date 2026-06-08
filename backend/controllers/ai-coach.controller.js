const svc = require('../services/ai-coach.service');

const getContext = async (req, res, next) => {
  try {
    res.json(await svc.getContext(req.user.id));
  } catch (e) {
    next(e);
  }
};

const chat = async (req, res, next) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }
    res.json(await svc.chat(req.user.id, messages));
  } catch (e) {
    console.error('[AI Coach] chat failed:');
    console.error('  message :', e.message);
    console.error('  status  :', e.status ?? e.statusCode ?? '—');
    console.error('  details :', e.errorDetails ?? e.response?.data ?? '—');
    console.error('  stack   :', e.stack);
    next(e);
  }
};

module.exports = { getContext, chat };
