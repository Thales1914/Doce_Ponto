const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers');

let ctx;
let brigadeiro;
let beijinho;

before(async () => {
  ctx = await setup();
  const criar = async (body) => (await ctx.api('POST', '/produtos', { token: ctx.token, body })).body;
  brigadeiro = await criar({ nome: 'Brigadeiro', preco: 3.5, quantidade_disponivel: 50 });
  beijinho = await criar({ nome: 'Beijinho', preco: 4, quantidade_disponivel: 10 });
});
after(() => ctx.teardown());

const novoPedido = (over = {}) => ({
  cliente: { nome: 'Maria Silva', contato: '(11) 99999-0000' },
  itens: [
    { produto_id: brigadeiro.id, quantidade: 10 },
    { produto_id: beijinho.id, quantidade: 5 },
  ],
  observacoes: 'Entregar depois das 14h',
  ...over,
});

// ---------------------------------------------------------------- Fase 4
test('[Fase 4] chamada sem autenticação cria pedido e retorna o código de acompanhamento', async () => {
  const res = await ctx.api('POST', '/pedidos', { body: novoPedido() });
  assert.equal(res.status, 201);
  assert.match(res.body.numero_pedido, /^PED-[A-Z2-9]{8}$/);
  assert.equal(res.body.status, 'solicitado');
  assert.equal(res.body.total, 55); // 10*3.5 + 5*4
  assert.equal(res.body.itens.length, 2);
});

test('[Fase 4] pedidos recebem números únicos e reutilizam o cliente pelo contato', async () => {
  const a = await ctx.api('POST', '/pedidos', { body: novoPedido() });
  const b = await ctx.api('POST', '/pedidos', { body: novoPedido({ cliente: { nome: 'Maria S.', contato: '(11) 99999-0000' } }) });
  assert.notEqual(a.body.numero_pedido, b.body.numero_pedido);
  const { rows } = await ctx.pool.query("SELECT count(*)::int AS n FROM clientes WHERE contato = '(11) 99999-0000'");
  assert.equal(rows[0].n, 1);
});

test('[Fase 4] o preço é congelado no momento do pedido e itens repetidos são somados', async () => {
  const res = await ctx.api('POST', '/pedidos', {
    body: novoPedido({
      itens: [
        { produto_id: beijinho.id, quantidade: 2 },
        { produto_id: beijinho.id, quantidade: 3 },
      ],
    }),
  });
  assert.equal(res.body.itens.length, 1);
  assert.equal(res.body.itens[0].quantidade, 5);
  await ctx.api('PUT', `/produtos/${beijinho.id}`, { token: ctx.token, body: { preco: 9 } });
  const { rows } = await ctx.pool.query(
    'SELECT i.preco_unitario FROM itens_pedido i JOIN pedidos p ON p.id = i.pedido_id WHERE p.numero_pedido = $1',
    [res.body.numero_pedido],
  );
  assert.equal(rows[0].preco_unitario, 4);
  await ctx.api('PUT', `/produtos/${beijinho.id}`, { token: ctx.token, body: { preco: 4 } });
});

test('[Fase 4] rejeita dados inválidos e produtos inexistentes/inativos', async () => {
  const post = (b) => ctx.api('POST', '/pedidos', { body: b });
  assert.equal((await post({})).status, 400);
  assert.equal((await post(novoPedido({ itens: [] }))).status, 400);
  assert.equal((await post(novoPedido({ itens: [{ produto_id: brigadeiro.id, quantidade: 0 }] }))).status, 400);
  assert.equal((await post(novoPedido({ itens: [{ produto_id: 9999, quantidade: 1 }] }))).status, 400);
  assert.equal((await post(novoPedido({ cliente: { nome: '', contato: '1' } }))).status, 400);

  const inativo = (await ctx.api('POST', '/produtos', { token: ctx.token, body: { nome: 'Velho', preco: 1, ativo: false } })).body;
  assert.equal((await post(novoPedido({ itens: [{ produto_id: inativo.id, quantidade: 1 }] }))).status, 400);
});

test('[Fase 4] não é preciso ter estoque para solicitar (é conferido na confirmação)', async () => {
  const res = await ctx.api('POST', '/pedidos', { body: novoPedido({ itens: [{ produto_id: beijinho.id, quantidade: 500 }] }) });
  assert.equal(res.status, 201);
});
