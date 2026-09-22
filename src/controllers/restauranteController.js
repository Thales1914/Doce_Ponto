const restauranteService = require('../services/restauranteService');

exports.listar = async (req, res) => {
  res.json(await restauranteService.listar(req.valid.query));
};

exports.criar = async (req, res) => {
  res.status(201).json(await restauranteService.criar(req.valid.body));
};

exports.atualizar = async (req, res) => {
  res.json(await restauranteService.atualizar(req.valid.params.id, req.valid.body));
};
