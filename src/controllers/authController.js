const authService = require('../services/authService');

exports.login = async (req, res) => {
  res.json(await authService.login(req.valid.body));
};

exports.me = async (req, res) => {
  res.json(await authService.getProfile(req.admin.id));
};
