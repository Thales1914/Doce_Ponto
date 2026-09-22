const estoqueService = require('../services/estoqueService');

exports.registrar = async (req, res) => {
  res.status(201).json(await estoqueService.registrarMovimentacao(req.valid.body));
};

exports.listar = async (req, res) => {
  res.json(await estoqueService.listar(req.valid.query));
};
