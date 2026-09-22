const { pool, withTransaction } = require('../db/pool');
const AppError = require('../utils/AppError');
const produtoModel = require('../models/produtoModel');
const { aplicarMovimentacao } = require('./estoqueService');

// Visão pública do catálogo: sem saldo de estoque
const publico = ({ id, nome, descricao, preco }) => ({ id, nome, descricao, preco });

/** Visitantes veem só produtos ativos (sem estoque); a admin vê tudo e pode filtrar. */
async function listar({ isAdmin, ativo, busca }) {
  if (!isAdmin) return (await produtoModel.list(pool, { ativo: true, busca })).map(publico);
  return produtoModel.list(pool, { ativo, busca });
}

async function obter(id) {
  const produto = await produtoModel.findById(pool, id);
  if (!produto) throw AppError.notFound('Produto não encontrado.');
  return produto;
}

/** Saldo inicial, se informado, entra como movimentação de entrada para manter o histórico consistente. */
const criar = ({ quantidade_disponivel, ...dados }) =>
  withTransaction(async (client) => {
    const produto = await produtoModel.create(client, dados);
    if (quantidade_disponivel > 0) {
      await aplicarMovimentacao(client, {
        produtoId: produto.id, tipo: 'entrada', quantidade: quantidade_disponivel, motivo: 'Estoque inicial',
      });
      return produtoModel.findById(client, produto.id);
    }
    return produto;
  });

async function atualizar(id, dados) {
  const produto = await produtoModel.update(pool, id, dados);
  if (!produto) throw AppError.notFound('Produto não encontrado.');
  return produto;
}

/** Exclusão lógica: produtos ficam referenciados por pedidos, vendas e movimentações. */
async function remover(id) {
  const produto = await produtoModel.update(pool, id, { ativo: false });
  if (!produto) throw AppError.notFound('Produto não encontrado.');
}

module.exports = { listar, obter, criar, atualizar, remover };
