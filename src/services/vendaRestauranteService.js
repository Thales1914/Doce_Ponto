const { pool, withTransaction } = require('../db/pool');
const AppError = require('../utils/AppError');
const { paginated, offset } = require('../utils/pagination');
const restauranteModel = require('../models/restauranteModel');
const produtoModel = require('../models/produtoModel');
const vendaRestauranteModel = require('../models/vendaRestauranteModel');
const financeiroModel = require('../models/financeiroModel');
const { aplicarMovimentacao } = require('./estoqueService');
const financeiroService = require('./financeiroService');

const arredondar = (v) => Math.round(v * 100) / 100;

/**
 * Registra a venda (a entrega ao restaurante já é venda efetiva). Numa única transação:
 * grava a venda, dá baixa no estoque (recusa se faltar saldo) e lança a entrada pendente no financeiro.
 * Sem `valor_total`, usa preço do produto × quantidade.
 */
async function registrar({ restaurante_id, produto_id, quantidade, valor_total }) {
  return withTransaction(async (client) => {
    const restaurante = await restauranteModel.findById(client, restaurante_id);
    if (!restaurante) throw AppError.notFound('Restaurante não encontrado.');
    const produto = await produtoModel.findById(client, produto_id);
    if (!produto) throw AppError.notFound('Produto não encontrado.');

    const valor = valor_total ?? arredondar(produto.preco * quantidade);
    const vendaId = await vendaRestauranteModel.insert(client, {
      restauranteId: restaurante_id, produtoId: produto_id, quantidade, valorTotal: valor,
    });

    await aplicarMovimentacao(client, {
      produtoId: produto_id, tipo: 'saida', quantidade,
      motivo: `Venda para ${restaurante.nome}`, vendaId,
    });
    const entrada = await financeiroService.lancarEntradaVenda(client, {
      vendaId, restauranteNome: restaurante.nome, valor,
    });

    const venda = await vendaRestauranteModel.findById(client, vendaId);
    return { ...venda, entrada_financeira_id: entrada.id };
  });
}

/** Atualiza o pagamento da venda e a entrada financeira correspondente. */
async function atualizarPagamento(id, { status_pagamento, forma, data }) {
  return withTransaction(async (client) => {
    const venda = await vendaRestauranteModel.findById(client, id, { forUpdate: true });
    if (!venda) throw AppError.notFound('Venda não encontrada.');
    const entrada = await financeiroModel.findEntradaByVenda(client, id);
    await financeiroService.marcarEntrada(client, entrada.id, { status: status_pagamento, forma, data });
    return { ...(await vendaRestauranteModel.findById(client, id)), entrada_financeira_id: entrada.id };
  });
}

async function listar(filtros) {
  const { rows, total } = await vendaRestauranteModel.list(pool, { ...filtros, offset: offset(filtros) });
  return paginated(rows, total, filtros);
}

module.exports = { registrar, atualizarPagamento, listar };
