const authService = require('../services/auth.service');

function registerHandler(req, res, next) {
  try {
    const user = authService.register(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

function loginHandler(req, res, next) {
  try {
    const result = authService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

function meHandler(req, res, next) {
  try {
    const user = authService.getMe(req.user.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

function updateMeHandler(req, res, next) {
  try {
    const user = authService.updateMe(req.user.id, req.body);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = { registerHandler, loginHandler, meHandler, updateMeHandler };
