const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers');

let ctx;
const auth = () => ({ token: ctx.token });

before(async () => {
  ctx = await setup();
});
after(() => ctx.teardown());

test('dashboard exige autenticação e valida o período', async () => {
  assert.equal((await ctx.api('GET', '/dashboard/resumo')).status, 401);
  assert.equal((await ctx.api('GET', '/dashboard/resumo?inicio=2026-10-05&fim=2026-10-01', auth())).status, 400);
  assert.equal((await ctx.api('GET', '/dashboard/resumo?inicio=ontem', auth())).status, 400);
});

test('dashboard vazio retorna zeros e todos os status', async () => {
  const r = await ctx.api('GET', '/dashboard/resumo', auth());
  assert.equal(r.status, 200);
  assert.equal(r.body.vendas.total, 0);
  assert.equal(r.body.pendencias.total, 0);
  assert.deepEqual(Object.keys(r.body.pedidos_por_status), ['solicitado', 'confirmado', 'em_producao', 'pronto', 'entregue', 'cancelado']);
  assert.match(r.body.periodo.inicio, /^\d{4}-\d{2}-01$/);
});

test('dashboard consolida vendas, recebimentos, pendências, estoque e pedidos por status', async () => {
  const p = (await ctx.api('POST', '/produtos', { ...auth(), body: { nome: 'Brigadeiro', preco: 3, quantidade_disponivel: 100 } })).body;
  const rest = (await ctx.api('POST', '/restaurantes', { ...auth(), body: { nome: 'Sabor & Cia' } })).body;

  // 2 vendas a restaurante (60 + 30), uma delas paga
  const v1 = (await ctx.api('POST', '/vendas-restaurantes', { ...auth(), body: { restaurante_id: rest.id, produto_id: p.id, quantidade: 20 } })).body;
  await ctx.api('POST', '/vendas-restaurantes', { ...auth(), body: { restaurante_id: rest.id, produto_id: p.id, quantidade: 10 } });
  await ctx.api('PUT', `/vendas-restaurantes/${v1.id}/pagamento`, { ...auth(), body: { status_pagamento: 'recebido', forma: 'pix' } });

  // pedidos: um confirmado (12), um solicitado, um cancelado
  const novo = async () => {
    const r = (await ctx.api('POST', '/pedidos', { body: { cliente: { nome: 'Cli', contato: 'cli@x.com' }, itens: [{ produto_id: p.id, quantidade: 4 }] } })).body;
    return (await ctx.pool.query('SELECT id FROM pedidos WHERE numero_pedido = $1', [r.numero_pedido])).rows[0].id;
  };
  const conf = await novo();
  await ctx.api('PUT', `/pedidos/${conf}/status`, { ...auth(), body: { status: 'confirmado' } });
  await novo();
  const canc = await novo();
  await ctx.api('PUT', `/pedidos/${canc}/status`, { ...auth(), body: { status: 'confirmado' } });
  await ctx.api('PUT', `/pedidos/${canc}/status`, { ...auth(), body: { status: 'cancelado' } });

  // receita manual recebida e despesas
  await ctx.api('POST', '/financeiro/entradas', { ...auth(), body: { descricao: 'Feira', valor: 40 } });
  await ctx.api('POST', '/financeiro/saidas', { ...auth(), body: { descricao: 'Chocolate', categoria: 'insumos', valor: 25 } });

  const r = (await ctx.api('GET', '/dashboard/resumo', auth())).body;

  assert.equal(r.vendas.restaurantes.valor, 90);
  assert.equal(r.vendas.restaurantes.quantidade, 2);
  assert.equal(r.vendas.pedidos.valor, 12); // cancelado não conta
  assert.equal(r.vendas.pedidos.quantidade, 1);
  assert.equal(r.vendas.total, 102);
  assert.equal(r.vendas.por_dia.length, 1);
  assert.equal(r.vendas.por_dia[0].valor, 102);

  assert.equal(r.recebimentos.valor, 100); // venda paga 60 + feira 40
  assert.equal(r.pendencias.total, 42); // venda 30 + pedido 12
  assert.equal(r.pendencias.por_origem.restaurantes.valor, 30);
  assert.equal(r.pendencias.por_origem.pedidos.valor, 12);
  assert.equal(r.pendencias.por_origem.manual.quantidade, 0);
  assert.equal(r.despesas.valor, 25);
  assert.equal(r.saldo_periodo, 75);

  // estoque: 100 − 20 − 10 − 4 (confirmado) − 0 (cancelado estornado) = 66
  assert.equal(r.estoque.total_unidades, 66);
  assert.equal(r.estoque.produtos[0].quantidade_disponivel, 66);

  assert.deepEqual(r.pedidos_por_status, { solicitado: 1, confirmado: 1, em_producao: 0, pronto: 0, entregue: 0, cancelado: 1 });

  // período sem movimento: zera fluxos, mas pendências e estoque continuam (posição atual)
  const passado = (await ctx.api('GET', '/dashboard/resumo?inicio=2020-01-01&fim=2020-01-31', auth())).body;
  assert.equal(passado.vendas.total, 0);
  assert.equal(passado.recebimentos.valor, 0);
  assert.equal(passado.pedidos_por_status.confirmado, 0);
  assert.equal(passado.pendencias.total, 42);
  assert.equal(passado.estoque.total_unidades, 66);
});

test('documentação OpenAPI está disponível', async () => {
  const spec = await ctx.api('GET', '/docs/openapi.json');
  assert.equal(spec.status, 200);
  assert.equal(spec.body.openapi, '3.0.3');
  for (const rota of [
    '/auth/login', '/produtos', '/estoque/movimentacao', '/pedidos', '/pedidos/{numero}', '/pedidos/{id}/status',
    '/restaurantes', '/vendas-restaurantes', '/vendas-restaurantes/{id}/pagamento',
    '/financeiro/entradas', '/financeiro/saidas', '/dashboard/resumo',
  ]) {
    assert.ok(spec.body.paths[rota], `rota não documentada: ${rota}`);
  }
  const ui = await fetch(`${ctx.base}/docs/`);
  assert.equal(ui.status, 200);
  assert.match(await ui.text(), /swagger-ui/i);
});
