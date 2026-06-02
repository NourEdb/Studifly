const svc = require('../services/gamification.service');

const getProfile = async (req, res, next) => {
  try {
    res.json(await svc.getProfile(req.user.id));
  } catch (e) {
    next(e);
  }
};

module.exports = { getProfile };
