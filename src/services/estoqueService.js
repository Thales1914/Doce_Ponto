const { pool, withTransaction } = require('../db/pool');
const AppError = require('../utils/AppError');
const { paginated, offset } = require('../utils/pagination');
const produtoModel = require('../models/produtoModel');
const estoqueModel = require('../models/estoqueModel');

/**
 * Aplica uma movimentação de estoque dentro de uma transação já aberta (`client`).
 * Trava a linha do produto, valida o saldo e grava o novo saldo + o registro da movimentação.
 *  - entrada: soma `quantidade`
 *  - saida:   subtrai `quantidade` (recusa se maior que o saldo)
 *  - ajuste:  define o saldo como `quantidade` (contagem física)
 */
async function aplicarMovimentacao(client, { produtoId, tipo, quantidade, motivo, pedidoId, vendaId }) {
  const produto = await produtoModel.findById(client, produtoId, { forUpdate: true });
  if (!produto) throw AppError.notFound('Produto não encontrado.');

  const saldoAnterior = produto.quantidade_disponivel;
  let saldoPosterior;
  if (tipo === 'entrada') saldoPosterior = saldoAnterior + quantidade;
  else if (tipo === 'ajuste') saldoPosterior = quantidade;
  else {
    if (quantidade > saldoAnterior) {
      throw AppError.conflict(
        `Estoque insuficiente para "${produto.nome}": disponível ${saldoAnterior}, solicitado ${quantidade}.`,
        'ESTOQUE_INSUFICIENTE',
      );
    }
    saldoPosterior = saldoAnterior - quantidade;
  }

  await produtoModel.setSaldo(client, produtoId, saldoPosterior);
  return estoqueModel.insert(client, {
    produtoId, tipo, quantidade, saldoAnterior, saldoPosterior, motivo, pedidoId, vendaId,
  });
}

const registrarMovimentacao = ({ produto_id, tipo, quantidade, motivo }) =>
  withTransaction((client) => aplicarMovimentacao(client, { produtoId: produto_id, tipo, quantidade, motivo }));

async function listar(filtros) {
  const { rows, total } = await estoqueModel.list(pool, { ...filtros, offset: offset(filtros) });
  return paginated(rows, total, filtros);
}

module.exports = { aplicarMovimentacao, registrarMovimentacao, listar };
