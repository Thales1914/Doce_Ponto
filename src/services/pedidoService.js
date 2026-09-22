const { pool, withTransaction } = require('../db/pool');
const AppError = require('../utils/AppError');
const { gerarNumeroPedido } = require('../utils/numeroPedido');
const { paginated, offset } = require('../utils/pagination');
const { aplicarMovimentacao } = require('./estoqueService');
const financeiroService = require('./financeiroService');
const produtoModel = require('../models/produtoModel');
const clienteModel = require('../models/clienteModel');
const pedidoModel = require('../models/pedidoModel');

const arredondar = (v) => Math.round(v * 100) / 100;
const totalDe = (itens) => arredondar(itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0));

/** Junta itens repetidos do mesmo produto somando as quantidades. */
function consolidarItens(itens) {
  const porProduto = new Map();
  for (const { produto_id, quantidade } of itens) {
    porProduto.set(produto_id, (porProduto.get(produto_id) || 0) + quantidade);
  }
  return [...porProduto].map(([produto_id, quantidade]) => ({ produto_id, quantidade }));
}

/** Fase 4 — criação pública. O estoque só é conferido/baixado quando a admin confirma o pedido. */
async function criar({ cliente, itens, observacoes }) {
  const consolidados = consolidarItens(itens);

  return withTransaction(async (client) => {
    const produtos = await produtoModel.findByIds(client, consolidados.map((i) => i.produto_id));
    const porId = new Map(produtos.map((p) => [p.id, p]));

    const invalidos = consolidados.filter((i) => !porId.get(i.produto_id)?.ativo).map((i) => i.produto_id);
    if (invalidos.length) {
      throw AppError.badRequest('Há produtos inexistentes ou indisponíveis no pedido.', [
        { local: 'body', campo: 'itens', mensagem: `Produtos indisponíveis: ${invalidos.join(', ')}` },
      ]);
    }

    const itensComPreco = consolidados.map((i) => ({ ...i, preco_unitario: porId.get(i.produto_id).preco }));
    const clienteRow = await clienteModel.findOrCreate(client, cliente);

    let pedido = null;
    for (let tentativa = 0; tentativa < 5 && !pedido; tentativa++) {
      pedido = await pedidoModel.insert(client, {
        numeroPedido: gerarNumeroPedido(),
        clienteId: clienteRow.id,
        observacoes,
      });
    }
    if (!pedido) throw new Error('Não foi possível gerar um número de pedido único.');

    await pedidoModel.insertItens(client, pedido.id, itensComPreco);
    await pedidoModel.insertHistorico(client, { pedidoId: pedido.id, statusNovo: 'solicitado' });

    const itensPedido = await pedidoModel.findItens(client, pedido.id);
    return {
      numero_pedido: pedido.numero_pedido,
      status: pedido.status,
      total: totalDe(itensPedido),
      itens: itensPedido,
      observacoes: pedido.observacoes,
      criado_em: pedido.criado_em,
      mensagem: 'Pedido recebido! Guarde o número para acompanhar o andamento.',
    };
  });
}

// ---------------------------------------------------------------- Fase 5 — gestão administrativa

// Fluxo sequencial; cancelamento possível até antes da entrega. Não pular etapas garante que o
// estoque seja baixado na confirmação.
const TRANSICOES = {
  solicitado: ['confirmado', 'cancelado'],
  confirmado: ['em_producao', 'cancelado'],
  em_producao: ['pronto', 'cancelado'],
  pronto: ['entregue', 'cancelado'],
  entregue: [],
  cancelado: [],
};

async function listar(filtros) {
  const { rows, total } = await pedidoModel.list(pool, { ...filtros, offset: offset(filtros) });
  return paginated(rows, total, filtros);
}

async function montarDetalhes(db, pedido) {
  const [cliente, itens, historico, observacoes] = await Promise.all([
    pedidoModel.findCliente(db, pedido.cliente_id),
    pedidoModel.findItens(db, pedido.id),
    pedidoModel.findHistorico(db, pedido.id),
    pedidoModel.findObservacoes(db, pedido.id),
  ]);
  const { estoque_baixado, cliente_id, ...dados } = pedido;
  return {
    ...dados,
    cliente,
    itens,
    total: totalDe(itens),
    historico,
    observacoes_adicionais: observacoes,
  };
}

async function detalhar(id) {
  const pedido = await pedidoModel.findById(pool, id);
  if (!pedido) throw AppError.notFound('Pedido não encontrado.');
  return montarDetalhes(pool, pedido);
}

/**
 * Altera o status validando a transição. Numa única transação:
 *  - confirmado: baixa o estoque dos itens (saída) — recusa se faltar saldo
 *  - confirmado: lança a entrada pendente do pedido no financeiro
 *  - cancelado:  estorna o estoque (entrada) se já tinha sido baixado e cancela a entrada pendente
 *  - registra o histórico da alteração
 */
async function alterarStatus(id, { status: novo, observacao }, adminId) {
  return withTransaction(async (client) => {
    const pedido = await pedidoModel.findById(client, id, { forUpdate: true });
    if (!pedido) throw AppError.notFound('Pedido não encontrado.');

    if (!TRANSICOES[pedido.status].includes(novo)) {
      const permitidas = TRANSICOES[pedido.status];
      throw AppError.conflict(
        `Transição inválida: ${pedido.status} → ${novo}. ` +
          (permitidas.length ? `Permitidas: ${permitidas.join(', ')}.` : 'O pedido já está finalizado.'),
        'TRANSICAO_INVALIDA',
      );
    }

    let estoqueBaixado;
    if (novo === 'confirmado') {
      const itens = await pedidoModel.findItens(client, id);
      // ordem fixa por produto evita deadlock entre confirmações simultâneas
      for (const item of [...itens].sort((a, b) => a.produto_id - b.produto_id)) {
        await aplicarMovimentacao(client, {
          produtoId: item.produto_id, tipo: 'saida', quantidade: item.quantidade,
          motivo: `Pedido ${pedido.numero_pedido}`, pedidoId: id,
        });
      }
      estoqueBaixado = true;
      await financeiroService.lancarEntradaPedido(client, {
        pedidoId: id, numeroPedido: pedido.numero_pedido, valor: totalDe(itens),
      });
    } else if (novo === 'cancelado' && pedido.estoque_baixado) {
      const itens = await pedidoModel.findItens(client, id);
      for (const item of [...itens].sort((a, b) => a.produto_id - b.produto_id)) {
        await aplicarMovimentacao(client, {
          produtoId: item.produto_id, tipo: 'entrada', quantidade: item.quantidade,
          motivo: `Estorno: cancelamento do pedido ${pedido.numero_pedido}`, pedidoId: id,
        });
      }
      estoqueBaixado = false;
    }
    if (novo === 'cancelado') await financeiroService.cancelarEntradaPedido(client, id);

    const atualizado = await pedidoModel.updateStatus(client, id, { status: novo, estoqueBaixado });
    await pedidoModel.insertHistorico(client, {
      pedidoId: id, statusAnterior: pedido.status, statusNovo: novo, adminId, observacao,
    });
    return montarDetalhes(client, atualizado);
  });
}

// ---------------------------------------------------------------- Fase 6 — acompanhamento pelo cliente

const DESCRICAO_STATUS = {
  solicitado: 'Pedido recebido, aguardando confirmação',
  confirmado: 'Pedido confirmado',
  em_producao: 'Em produção',
  pronto: 'Pronto para entrega/retirada',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

async function buscarPorNumero(numero) {
  const pedido = await pedidoModel.findByNumero(pool, numero);
  if (!pedido) throw AppError.notFound('Pedido não encontrado.');
  return pedido;
}

/** Visão pública: sem dados pessoais nem observações internas da administradora. */
async function acompanhar(numero) {
  const pedido = await buscarPorNumero(numero);
  const [itens, historico, observacoes] = await Promise.all([
    pedidoModel.findItens(pool, pedido.id),
    pedidoModel.findHistorico(pool, pedido.id),
    pedidoModel.findObservacoes(pool, pedido.id),
  ]);
  return {
    numero_pedido: pedido.numero_pedido,
    status: pedido.status,
    status_descricao: DESCRICAO_STATUS[pedido.status],
    criado_em: pedido.criado_em,
    atualizado_em: pedido.atualizado_em,
    itens,
    total: totalDe(itens),
    observacoes: pedido.observacoes,
    observacoes_adicionais: observacoes,
    historico: historico.map((h) => ({
      status: h.status_novo,
      status_descricao: DESCRICAO_STATUS[h.status_novo],
      data: h.criado_em,
    })),
  };
}

async function adicionarObservacao(numero, texto) {
  return withTransaction(async (client) => {
    const base = await pedidoModel.findByNumero(client, numero);
    if (!base) throw AppError.notFound('Pedido não encontrado.');
    const pedido = await pedidoModel.findById(client, base.id, { forUpdate: true });
    if (['entregue', 'cancelado'].includes(pedido.status)) {
      throw AppError.conflict('Pedido finalizado: não é possível incluir novas observações.', 'PEDIDO_FINALIZADO');
    }
    return pedidoModel.insertObservacao(client, pedido.id, texto);
  });
}

module.exports = { criar, listar, detalhar, alterarStatus, acompanhar, adicionarObservacao, totalDe, arredondar };
