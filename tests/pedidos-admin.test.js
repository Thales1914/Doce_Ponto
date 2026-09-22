const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers');

let ctx;
let brigadeiro;
let beijinho;

before(async () => {
  ctx = await setup();
  const criar = async (body) => (await ctx.api('POST', '/produtos', { token: ctx.token, body })).body;
  brigadeiro = await criar({ nome: 'Brigadeiro', preco: 3.5, quantidade_disponivel: 200 });
  beijinho = await criar({ nome: 'Beijinho', preco: 4, quantidade_disponivel: 100 });
});
after(() => ctx.teardown());

const novoPedido = (over = {}) => ({
  cliente: { nome: 'Maria Silva', contato: '(11) 99999-0000' },
  itens: [
    { produto_id: brigadeiro.id, quantidade: 10 },
    { produto_id: beijinho.id, quantidade: 5 },
  ],
  ...over,
});
const criarPedido = async (over) => (await ctx.api('POST', '/pedidos', { body: novoPedido(over) })).body;
const idDoPedido = async (numero) =>
  (await ctx.pool.query('SELECT id FROM pedidos WHERE numero_pedido = $1', [numero])).rows[0].id;
const mudar = (id, status, observacao) =>
  ctx.api('PUT', `/pedidos/${id}/status`, { token: ctx.token, body: { status, observacao } });
const saldo = async (produtoId) =>
  (await ctx.api('GET', `/produtos/${produtoId}`, { token: ctx.token })).body.quantidade_disponivel;

test('[Fase 5] rotas administrativas de pedidos exigem token', async () => {
  assert.equal((await ctx.api('GET', '/pedidos')).status, 401);
  assert.equal((await ctx.api('GET', '/pedidos/1/detalhes')).status, 401);
  assert.equal((await ctx.api('PUT', '/pedidos/1/status', { body: { status: 'confirmado' } })).status, 401);
});

test('[Fase 5] listagem com filtros por status, cliente e data, com paginação', async () => {
  await criarPedido();
  await criarPedido();
  const p = await criarPedido({ cliente: { nome: 'Joana Filtro', contato: 'joana.filtro@email.com' } });
  const id = await idDoPedido(p.numero_pedido);

  const todos = await ctx.api('GET', '/pedidos?limit=2', { token: ctx.token });
  assert.equal(todos.status, 200);
  assert.equal(todos.body.data.length, 2);
  assert.ok(todos.body.meta.total >= 3);

  const porCliente = await ctx.api('GET', '/pedidos?cliente=joana', { token: ctx.token });
  assert.equal(porCliente.body.data.length, 1);
  assert.equal(porCliente.body.data[0].numero_pedido, p.numero_pedido);
  assert.equal(porCliente.body.data[0].total, 55);
  assert.equal(porCliente.body.data[0].cliente_nome, 'Joana Filtro');

  await mudar(id, 'cancelado');
  const porStatus = await ctx.api('GET', '/pedidos?status=cancelado', { token: ctx.token });
  assert.ok(porStatus.body.data.every((x) => x.status === 'cancelado'));
  assert.ok(porStatus.body.data.some((x) => x.id === id));

  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  assert.ok((await ctx.api('GET', `/pedidos?inicio=${hoje}&fim=${hoje}`, { token: ctx.token })).body.meta.total >= 3);
  assert.equal((await ctx.api('GET', '/pedidos?inicio=2020-01-01&fim=2020-01-31', { token: ctx.token })).body.meta.total, 0);

  assert.equal((await ctx.api('GET', '/pedidos?status=invalido', { token: ctx.token })).status, 400);
  assert.equal((await ctx.api('GET', '/pedidos?inicio=01/02/2026', { token: ctx.token })).status, 400);
});

test('[Fase 5] detalhes do pedido trazem cliente, itens, total e histórico', async () => {
  const p = await criarPedido();
  const id = await idDoPedido(p.numero_pedido);
  const d = await ctx.api('GET', `/pedidos/${id}/detalhes`, { token: ctx.token });
  assert.equal(d.status, 200);
  assert.equal(d.body.cliente.contato, '(11) 99999-0000');
  assert.equal(d.body.itens.length, 2);
  assert.equal(d.body.total, 55);
  assert.equal(d.body.historico.length, 1);
  assert.equal((await ctx.api('GET', '/pedidos/9999/detalhes', { token: ctx.token })).status, 404);
});

test('[Fase 5] alterar o status registra o histórico da alteração (marco da Fase 5)', async () => {
  const p = await criarPedido();
  const id = await idDoPedido(p.numero_pedido);
  const r1 = await mudar(id, 'confirmado', 'Pagamento combinado');
  assert.equal(r1.status, 200);
  assert.equal(r1.body.status, 'confirmado');
  await mudar(id, 'em_producao');

  const d = (await ctx.api('GET', `/pedidos/${id}/detalhes`, { token: ctx.token })).body;
  assert.deepEqual(d.historico.map((h) => h.status_novo), ['solicitado', 'confirmado', 'em_producao']);
  assert.equal(d.historico[1].status_anterior, 'solicitado');
  assert.equal(d.historico[1].observacao, 'Pagamento combinado');
  assert.equal(d.historico[1].admin_nome, 'Admin Teste');
});

test('[Fase 5] confirmar baixa o estoque com movimentação de saída; saldo insuficiente bloqueia', async () => {
  const antesB = await saldo(brigadeiro.id);
  const antesJ = await saldo(beijinho.id);
  const p = await criarPedido();
  const id = await idDoPedido(p.numero_pedido);
  assert.equal((await mudar(id, 'confirmado')).status, 200);
  assert.equal(await saldo(brigadeiro.id), antesB - 10);
  assert.equal(await saldo(beijinho.id), antesJ - 5);

  const mov = await ctx.api('GET', '/estoque/movimentacoes?tipo=saida', { token: ctx.token });
  assert.ok(mov.body.data.some((m) => m.pedido_id === id));

  // pedido grande demais: nada é baixado e o status não muda
  const grande = await criarPedido({
    itens: [{ produto_id: brigadeiro.id, quantidade: 1000 }, { produto_id: beijinho.id, quantidade: 1 }],
  });
  const gid = await idDoPedido(grande.numero_pedido);
  const antesB2 = await saldo(brigadeiro.id);
  const antesJ2 = await saldo(beijinho.id);
  const r = await mudar(gid, 'confirmado');
  assert.equal(r.status, 409);
  assert.equal(r.body.erro.codigo, 'ESTOQUE_INSUFICIENTE');
  assert.equal(await saldo(brigadeiro.id), antesB2);
  assert.equal(await saldo(beijinho.id), antesJ2); // transação desfeita por completo
  assert.equal((await ctx.api('GET', `/pedidos/${gid}/detalhes`, { token: ctx.token })).body.status, 'solicitado');
});

test('[Fase 5] cancelar pedido confirmado estorna o estoque; cancelar antes não mexe nele', async () => {
  const p = await criarPedido();
  const id = await idDoPedido(p.numero_pedido);
  await mudar(id, 'confirmado');
  const baixado = await saldo(brigadeiro.id);
  assert.equal((await mudar(id, 'cancelado', 'Cliente desistiu')).status, 200);
  assert.equal(await saldo(brigadeiro.id), baixado + 10);

  const q = await criarPedido();
  const qid = await idDoPedido(q.numero_pedido);
  const antes = await saldo(brigadeiro.id);
  await mudar(qid, 'cancelado');
  assert.equal(await saldo(brigadeiro.id), antes);
});

test('[Fase 5] transições inválidas são recusadas e pedidos finalizados não mudam', async () => {
  const p = await criarPedido();
  const id = await idDoPedido(p.numero_pedido);
  const pular = await mudar(id, 'pronto');
  assert.equal(pular.status, 409);
  assert.equal(pular.body.erro.codigo, 'TRANSICAO_INVALIDA');
  assert.equal((await mudar(id, 'solicitado')).status, 409);

  for (const s of ['confirmado', 'em_producao', 'pronto', 'entregue']) assert.equal((await mudar(id, s)).status, 200);
  assert.equal((await mudar(id, 'cancelado')).status, 409);
  assert.equal((await mudar(9999, 'confirmado')).status, 404);
  assert.equal((await mudar(id, 'inexistente')).status, 400);
});

test('[Fase 5] confirmações concorrentes do mesmo pedido baixam o estoque uma única vez', async () => {
  const p = await criarPedido({ itens: [{ produto_id: brigadeiro.id, quantidade: 2 }] });
  const id = await idDoPedido(p.numero_pedido);
  const antes = await saldo(brigadeiro.id);
  const rs = await Promise.all([mudar(id, 'confirmado'), mudar(id, 'confirmado'), mudar(id, 'confirmado')]);
  assert.equal(rs.filter((r) => r.status === 200).length, 1);
  assert.equal(await saldo(brigadeiro.id), antes - 2);
});
