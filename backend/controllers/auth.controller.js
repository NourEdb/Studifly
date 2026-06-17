const authService = require('../services/auth.service');

const registerHandler = async (req, res, next) => {
  try { res.status(201).json(await authService.register(req.body)); } catch (e) { next(e); }
};

const loginHandler = async (req, res, next) => {
  try { res.json(await authService.login(req.body)); } catch (e) { next(e); }
};

const meHandler = async (req, res, next) => {
  try { res.json(await authService.getMe(req.user.id)); } catch (e) { next(e); }
};

const updateMeHandler = async (req, res, next) => {
  try { res.json(await authService.updateMe(req.user.id, req.body)); } catch (e) { next(e); }
};

const changePasswordHandler = async (req, res, next) => {
  try { res.json(await authService.changePassword(req.user.id, req.body)); } catch (e) { next(e); }
};

const deleteAccountHandler = async (req, res, next) => {
  try { res.json(await authService.deleteAccount(req.user.id, req.body)); } catch (e) { next(e); }
};

const forgotPasswordHandler = async (req, res, next) => {
  try { res.json(await authService.requestPasswordReset(req.body.email)); } catch (e) { next(e); }
};

const resetPasswordHandler = async (req, res, next) => {
  try { res.json(await authService.resetPassword(req.body.token, req.body.newPassword)); } catch (e) { next(e); }
};

module.exports = {
  registerHandler, loginHandler, meHandler, updateMeHandler,
  changePasswordHandler, deleteAccountHandler,
  forgotPasswordHandler, resetPasswordHandler,
};
