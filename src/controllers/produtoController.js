const produtoService = require('../services/produtoService');

exports.listar = async (req, res) => {
  res.json(await produtoService.listar({ isAdmin: Boolean(req.admin), ...req.valid.query }));
};

exports.obter = async (req, res) => {
  res.json(await produtoService.obter(req.valid.params.id));
};

exports.criar = async (req, res) => {
  res.status(201).json(await produtoService.criar(req.valid.body));
};

exports.atualizar = async (req, res) => {
  res.json(await produtoService.atualizar(req.valid.params.id, req.valid.body));
};

exports.remover = async (req, res) => {
  await produtoService.remover(req.valid.params.id);
  res.status(204).end();
};
