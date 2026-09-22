const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers');

let ctx;
before(async () => {
  ctx = await setup();
});
after(() => ctx.teardown());

const criarProduto = (over = {}) =>
  ctx.api('POST', '/produtos', {
    token: ctx.token,
    body: { nome: 'Brigadeiro', preco: 3.5, ...over },
  });

test('rotas de produtos e estoque exigem autenticação (exceto o catálogo público)', async () => {
  assert.equal((await ctx.api('POST', '/produtos', { body: { nome: 'x', preco: 1 } })).status, 401);
  assert.equal((await ctx.api('PUT', '/produtos/1', { body: { nome: 'x' } })).status, 401);
  assert.equal((await ctx.api('DELETE', '/produtos/1')).status, 401);
  assert.equal((await ctx.api('POST', '/estoque/movimentacao', { body: {} })).status, 401);
  assert.equal((await ctx.api('GET', '/produtos')).status, 200);
});

test('CRUD de produtos', async () => {
  const c = await criarProduto({ descricao: 'De chocolate', quantidade_disponivel: 10 });
  assert.equal(c.status, 201);
  assert.equal(c.body.preco, 3.5);
  assert.equal(c.body.quantidade_disponivel, 10);
  assert.equal(c.body.ativo, true);
  const id = c.body.id;

  // saldo inicial gerou movimentação de entrada
  const mov = await ctx.api('GET', `/estoque/movimentacoes?produto_id=${id}`, { token: ctx.token });
  assert.equal(mov.body.data.length, 1);
  assert.equal(mov.body.data[0].tipo, 'entrada');

  const u = await ctx.api('PUT', `/produtos/${id}`, { token: ctx.token, body: { nome: 'Brigadeiro Gourmet', preco: 4 } });
  assert.equal(u.status, 200);
  assert.equal(u.body.nome, 'Brigadeiro Gourmet');
  assert.equal(u.body.preco, 4);

  // saldo não pode ser alterado por PUT
  const bad = await ctx.api('PUT', `/produtos/${id}`, { token: ctx.token, body: { quantidade_disponivel: 999 } });
  assert.equal(bad.status, 400);

  assert.equal((await ctx.api('GET', `/produtos/${id}`, { token: ctx.token })).body.nome, 'Brigadeiro Gourmet');
  assert.equal((await ctx.api('GET', '/produtos/9999', { token: ctx.token })).status, 404);
});

test('validação de produto: preço negativo, casas decimais e nome vazio', async () => {
  assert.equal((await criarProduto({ preco: -1 })).status, 400);
  assert.equal((await criarProduto({ preco: 1.999 })).status, 400);
  assert.equal((await criarProduto({ nome: '  ' })).status, 400);
  assert.equal((await criarProduto({ quantidade_disponivel: 1.5 })).status, 400);
});

test('catálogo público mostra só ativos e esconde saldo; DELETE é exclusão lógica', async () => {
  const a = (await criarProduto({ nome: 'Beijinho', quantidade_disponivel: 5 })).body;
  const b = (await criarProduto({ nome: 'Cajuzinho' })).body;
  assert.equal((await ctx.api('DELETE', `/produtos/${b.id}`, { token: ctx.token })).status, 204);

  const publico = (await ctx.api('GET', '/produtos')).body;
  assert.ok(publico.some((p) => p.id === a.id));
  assert.ok(!publico.some((p) => p.id === b.id));
  assert.equal(publico[0].quantidade_disponivel, undefined);

  const admin = (await ctx.api('GET', '/produtos', { token: ctx.token })).body;
  const inativo = admin.find((p) => p.id === b.id);
  assert.equal(inativo.ativo, false);
  assert.ok(admin.find((p) => p.id === a.id).quantidade_disponivel === 5);
});

test('entrada, saída e ajuste atualizam o saldo e registram saldo anterior/posterior', async () => {
  const { id } = (await criarProduto({ nome: 'Trufa' })).body;
  const mov = (body) => ctx.api('POST', '/estoque/movimentacao', { token: ctx.token, body: { produto_id: id, ...body } });
  const saldo = async () => (await ctx.api('GET', `/produtos/${id}`, { token: ctx.token })).body.quantidade_disponivel;

  const e = await mov({ tipo: 'entrada', quantidade: 20, motivo: 'Produção do dia' });
  assert.equal(e.status, 201);
  assert.deepEqual([e.body.saldo_anterior, e.body.saldo_posterior], [0, 20]);

  const s = await mov({ tipo: 'saida', quantidade: 8, motivo: 'Perda' });
  assert.deepEqual([s.body.saldo_anterior, s.body.saldo_posterior], [20, 12]);
  assert.equal(await saldo(), 12);

  const a = await mov({ tipo: 'ajuste', quantidade: 15, motivo: 'Contagem física' });
  assert.deepEqual([a.body.saldo_anterior, a.body.saldo_posterior], [12, 15]);
  assert.equal(await saldo(), 15);

  const lista = await ctx.api('GET', `/estoque/movimentacoes?produto_id=${id}&tipo=saida`, { token: ctx.token });
  assert.equal(lista.body.meta.total, 1);
});

test('não permite saída maior que o saldo disponível (marco da Fase 3)', async () => {
  const { id } = (await criarProduto({ nome: 'Palha italiana', quantidade_disponivel: 5 })).body;
  const res = await ctx.api('POST', '/estoque/movimentacao', {
    token: ctx.token,
    body: { produto_id: id, tipo: 'saida', quantidade: 6 },
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.erro.codigo, 'ESTOQUE_INSUFICIENTE');
  const p = await ctx.api('GET', `/produtos/${id}`, { token: ctx.token });
  assert.equal(p.body.quantidade_disponivel, 5);

  // saída exata do saldo é permitida
  const ok = await ctx.api('POST', '/estoque/movimentacao', {
    token: ctx.token,
    body: { produto_id: id, tipo: 'saida', quantidade: 5 },
  });
  assert.equal(ok.status, 201);
});

test('saídas concorrentes nunca deixam o saldo negativo', async () => {
  const { id } = (await criarProduto({ nome: 'Casadinho', quantidade_disponivel: 10 })).body;
  const resultados = await Promise.all(
    Array.from({ length: 6 }, () =>
      ctx.api('POST', '/estoque/movimentacao', { token: ctx.token, body: { produto_id: id, tipo: 'saida', quantidade: 3 } }),
    ),
  );
  assert.equal(resultados.filter((r) => r.status === 201).length, 3);
  assert.equal(resultados.filter((r) => r.status === 409).length, 3);
  const p = await ctx.api('GET', `/produtos/${id}`, { token: ctx.token });
  assert.equal(p.body.quantidade_disponivel, 1);
});

test('validações da movimentação', async () => {
  const { id } = (await criarProduto({ nome: 'Bombom' })).body;
  const mov = (body) => ctx.api('POST', '/estoque/movimentacao', { token: ctx.token, body });
  assert.equal((await mov({ produto_id: id, tipo: 'entrada', quantidade: 0 })).status, 400);
  assert.equal((await mov({ produto_id: id, tipo: 'saida', quantidade: -2 })).status, 400);
  assert.equal((await mov({ produto_id: id, tipo: 'ajuste', quantidade: 3 })).status, 400); // sem motivo
  assert.equal((await mov({ produto_id: id, tipo: 'outro', quantidade: 1 })).status, 400);
  assert.equal((await mov({ produto_id: 9999, tipo: 'entrada', quantidade: 1 })).status, 404);
});
