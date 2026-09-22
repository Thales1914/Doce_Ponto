const financeiroService = require('../services/financeiroService');

exports.listarEntradas = async (req, res) => {
  res.json(await financeiroService.listarEntradas(req.valid.query));
};

exports.criarEntrada = async (req, res) => {
  res.status(201).json(await financeiroService.criarEntradaManual(req.valid.body));
};

exports.atualizarStatusEntrada = async (req, res) => {
  res.json(await financeiroService.atualizarStatusEntrada(req.valid.params.id, req.valid.body));
};

exports.listarSaidas = async (req, res) => {
  res.json(await financeiroService.listarSaidas(req.valid.query));
};

exports.criarSaida = async (req, res) => {
  res.status(201).json(await financeiroService.criarSaida(req.valid.body));
};
