const svc = require('../services/events.service');
const { sendReminderEmail } = require('../services/email.service');
const db = require('../database/db');

const getAll        = async (req, res, next) => { try { res.json(await svc.getAll(req.user.id)); } catch (e) { next(e); } };
const getCustomTypes = async (req, res, next) => { try { res.json(await svc.getCustomTypes(req.user.id)); } catch (e) { next(e); } };
const create  = async (req, res, next) => { try { res.status(201).json(await svc.create(req.user.id, req.body)); } catch (e) { next(e); } };
const update  = async (req, res, next) => { try { res.json(await svc.update(req.user.id, req.params.id, req.body)); } catch (e) { next(e); } };
const remove  = async (req, res, next) => { try { await svc.remove(req.user.id, req.params.id); res.status(204).end(); } catch (e) { next(e); } };

const testEmail = async (req, res, next) => {
  try {
    const user = await db.get('SELECT email FROM users WHERE id = ?', [req.user.id]);
    if (!user) { const e = new Error('User not found'); e.status = 404; throw e; }

    const fakeEvent = {
      title: 'Test Event — Email Setup Check',
      type: 'reminder',
      event_date: new Date().toISOString().slice(0, 10),
      event_time: '10:00',
      notes: 'This is a test email sent from Studifly to verify your email configuration is working correctly.',
    };

    await sendReminderEmail(user.email, fakeEvent);
    res.json({ ok: true, sentTo: user.email });
  } catch (e) { next(e); }
};

module.exports = { getAll, getCustomTypes, create, update, remove, testEmail };
