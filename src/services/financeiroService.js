const { pool, withTransaction } = require('../db/pool');
const AppError = require('../utils/AppError');
const { paginated, offset } = require('../utils/pagination');
const financeiroModel = require('../models/financeiroModel');
const vendaRestauranteModel = require('../models/vendaRestauranteModel');

// ---- Lançamentos automáticos (chamados por pedidos e vendas, dentro da transação deles)

const lancarEntradaPedido = (client, { pedidoId, numeroPedido, valor }) =>
  financeiroModel.insertEntrada(client, {
    pedidoId, valor, descricao: `Pedido ${numeroPedido}`, status: 'pendente',
  });

const lancarEntradaVenda = (client, { vendaId, restauranteNome, valor }) =>
  financeiroModel.insertEntrada(client, {
    vendaId, valor, descricao: `Venda para ${restauranteNome}`, status: 'pendente',
  });

const cancelarEntradaPedido = (client, pedidoId) =>
  financeiroModel.cancelarEntradaPendenteDoPedido(client, pedidoId);

// ---- Entradas

/**
 * Marca uma entrada como recebida/pendente. Se ela vier de uma venda a restaurante,
 * o status_pagamento da venda acompanha.
 */
async function marcarEntrada(client, id, { status, forma, data }) {
  const entrada = await financeiroModel.findEntradaById(client, id, { forUpdate: true });
  if (!entrada) throw AppError.notFound('Entrada não encontrada.');
  if (entrada.status === 'cancelado') {
    throw AppError.conflict('Entrada cancelada não pode ser alterada.', 'ENTRADA_CANCELADA');
  }
  const atualizada = await financeiroModel.updateEntradaStatus(client, id, { status, forma, data });
  if (entrada.venda_restaurante_id) {
    await vendaRestauranteModel.updateStatusPagamento(client, entrada.venda_restaurante_id, status);
  }
  return atualizada;
}

const atualizarStatusEntrada = (id, dados) => withTransaction((client) => marcarEntrada(client, id, dados));

const criarEntradaManual = ({ descricao, valor, forma, status, data }) =>
  financeiroModel.insertEntrada(pool, { descricao, valor, forma, status, data });

async function listarEntradas(filtros) {
  const { rows, totais } = await financeiroModel.listEntradas(pool, { ...filtros, offset: offset(filtros) });
  const soma = (s) => totais.find((t) => t.status === s)?.valor ?? 0;
  const quantidade = totais.reduce((n, t) => n + t.quantidade, 0);
  const resposta = paginated(rows, quantidade, filtros);
  // totais do filtro aplicado (não só da página)
  resposta.totais = {
    recebido: soma('recebido'),
    pendente: soma('pendente'),
    cancelado: soma('cancelado'),
  };
  return resposta;
}

// ---- Saídas

const criarSaida = (dados) => financeiroModel.insertSaida(pool, dados);

async function listarSaidas(filtros) {
  const { rows, total, valorTotal } = await financeiroModel.listSaidas(pool, { ...filtros, offset: offset(filtros) });
  const resposta = paginated(rows, total, filtros);
  resposta.totais = { valor: valorTotal };
  return resposta;
}

module.exports = {
  lancarEntradaPedido, lancarEntradaVenda, cancelarEntradaPedido,
  marcarEntrada, atualizarStatusEntrada, criarEntradaManual, listarEntradas, criarSaida, listarSaidas,
};
