const pedidoService = require('../services/pedidoService');

exports.criar = async (req, res) => {
  res.status(201).json(await pedidoService.criar(req.valid.body));
};

exports.listar = async (req, res) => {
  res.json(await pedidoService.listar(req.valid.query));
};

exports.detalhar = async (req, res) => {
  res.json(await pedidoService.detalhar(req.valid.params.id));
};

exports.acompanhar = async (req, res) => {
  res.json(await pedidoService.acompanhar(req.valid.params.numero));
};

exports.adicionarObservacao = async (req, res) => {
  const observacao = await pedidoService.adicionarObservacao(req.valid.params.numero, req.valid.body.texto);
  res.status(201).json(observacao);
};

exports.alterarStatus = async (req, res) => {
  res.json(await pedidoService.alterarStatus(req.valid.params.id, req.valid.body, req.admin.id));
};
