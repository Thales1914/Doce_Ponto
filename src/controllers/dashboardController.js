const dashboardService = require('../services/dashboardService');

exports.resumo = async (req, res) => {
  res.json(await dashboardService.resumo(req.valid.query));
};
