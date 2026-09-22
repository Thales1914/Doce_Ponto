const vendaService = require('../services/vendaRestauranteService');

exports.registrar = async (req, res) => {
  res.status(201).json(await vendaService.registrar(req.valid.body));
};

exports.listar = async (req, res) => {
  res.json(await vendaService.listar(req.valid.query));
};

exports.atualizarPagamento = async (req, res) => {
  res.json(await vendaService.atualizarPagamento(req.valid.params.id, req.valid.body));
};
