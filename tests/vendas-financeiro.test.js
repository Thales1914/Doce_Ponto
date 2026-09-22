const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers');

let ctx;
let produto;
let restaurante;
const auth = () => ({ token: ctx.token });
const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

before(async () => {
  ctx = await setup();
  produto = (await ctx.api('POST', '/produtos', { ...auth(), body: { nome: 'Brigadeiro', preco: 3, quantidade_disponivel: 100 } })).body;
  restaurante = (await ctx.api('POST', '/restaurantes', { ...auth(), body: { nome: 'Restaurante Sabor', contato: '(11) 3333-4444' } })).body;
});
after(() => ctx.teardown());

const saldo = async () => (await ctx.api('GET', `/produtos/${produto.id}`, auth())).body.quantidade_disponivel;
const vender = (body) => ctx.api('POST', '/vendas-restaurantes', { ...auth(), body: { restaurante_id: restaurante.id, produto_id: produto.id, ...body } });

test('rotas de restaurantes, vendas e financeiro exigem autenticação', async () => {
  for (const [m, p] of [
    ['GET', '/restaurantes'], ['POST', '/restaurantes'], ['POST', '/vendas-restaurantes'],
    ['PUT', '/vendas-restaurantes/1/pagamento'], ['GET', '/financeiro/entradas'], ['POST', '/financeiro/entradas'],
    ['GET', '/financeiro/saidas'], ['POST', '/financeiro/saidas'],
  ]) {
    assert.equal((await ctx.api(m, p, m === 'GET' ? {} : { body: {} })).status, 401, `${m} ${p}`);
  }
});

test('cadastro e listagem de restaurantes', async () => {
  assert.equal(restaurante.nome, 'Restaurante Sabor');
  assert.equal((await ctx.api('POST', '/restaurantes', { ...auth(), body: { nome: '' } })).status, 400);
  const lista = await ctx.api('GET', '/restaurantes?busca=sabor', auth());
  assert.equal(lista.body.length, 1);
  const up = await ctx.api('PUT', `/restaurantes/${restaurante.id}`, { ...auth(), body: { contato: 'novo@contato.com' } });
  assert.equal(up.body.contato, 'novo@contato.com');
  assert.equal(up.body.nome, 'Restaurante Sabor');
  assert.equal((await ctx.api('PUT', '/restaurantes/999', { ...auth(), body: { nome: 'X Y' } })).status, 404);
});

test('[MARCO Fase 7] venda confirmada reflete em estoque e financeiro', async () => {
  const antes = await saldo();
  const res = await vender({ quantidade: 20 });
  assert.equal(res.status, 201);
  assert.equal(res.body.valor_total, 60); // 20 × 3,00
  assert.equal(res.body.status_pagamento, 'pendente');
  assert.equal(res.body.restaurante_nome, 'Restaurante Sabor');

  // estoque: baixa + movimentação de saída ligada à venda
  assert.equal(await saldo(), antes - 20);
  const mov = await ctx.api('GET', '/estoque/movimentacoes?tipo=saida', auth());
  const m = mov.body.data.find((x) => x.venda_restaurante_id === res.body.id);
  assert.equal(m.quantidade, 20);

  // financeiro: entrada pendente com o valor da venda
  const ent = await ctx.api('GET', '/financeiro/entradas?origem=venda_restaurante', auth());
  const e = ent.body.data.find((x) => x.venda_restaurante_id === res.body.id);
  assert.equal(e.valor, 60);
  assert.equal(e.status, 'pendente');
  assert.equal(e.restaurante_nome, 'Restaurante Sabor');
  assert.equal(ent.body.totais.pendente, 60);
});

test('valor_total informado sobrescreve o cálculo automático', async () => {
  const res = await vender({ quantidade: 2, valor_total: 5.5 });
  assert.equal(res.body.valor_total, 5.5);
});

test('venda com saldo insuficiente é recusada sem deixar rastros', async () => {
  const antesSaldo = await saldo();
  const antesVendas = (await ctx.api('GET', '/vendas-restaurantes', auth())).body.meta.total;
  const antesEntradas = (await ctx.api('GET', '/financeiro/entradas', auth())).body.meta.total;

  const res = await vender({ quantidade: antesSaldo + 1 });
  assert.equal(res.status, 409);
  assert.equal(res.body.erro.codigo, 'ESTOQUE_INSUFICIENTE');
  assert.equal(await saldo(), antesSaldo);
  assert.equal((await ctx.api('GET', '/vendas-restaurantes', auth())).body.meta.total, antesVendas);
  assert.equal((await ctx.api('GET', '/financeiro/entradas', auth())).body.meta.total, antesEntradas);
});

test('validações da venda', async () => {
  assert.equal((await vender({ quantidade: 0 })).status, 400);
  assert.equal((await vender({ quantidade: 1, valor_total: -3 })).status, 400);
  assert.equal((await vender({ quantidade: 1, restaurante_id: 999 })).status, 404);
  assert.equal((await vender({ quantidade: 1, produto_id: 999 })).status, 404);
});

test('PUT /vendas-restaurantes/:id/pagamento marca recebido e sincroniza o financeiro', async () => {
  const venda = (await vender({ quantidade: 10 })).body;
  const pago = await ctx.api('PUT', `/vendas-restaurantes/${venda.id}/pagamento`, {
    ...auth(),
    body: { status_pagamento: 'recebido', forma: 'pix' },
  });
  assert.equal(pago.status, 200);
  assert.equal(pago.body.status_pagamento, 'recebido');

  const ent = (await ctx.api('GET', '/financeiro/entradas?status=recebido&origem=venda_restaurante', auth())).body.data
    .find((x) => x.venda_restaurante_id === venda.id);
  assert.equal(ent.forma, 'pix');
  assert.equal(ent.data, hoje());

  // volta para pendente
  const volta = await ctx.api('PUT', `/vendas-restaurantes/${venda.id}/pagamento`, { ...auth(), body: { status_pagamento: 'pendente' } });
  assert.equal(volta.body.status_pagamento, 'pendente');

  assert.equal((await ctx.api('PUT', '/vendas-restaurantes/999/pagamento', { ...auth(), body: { status_pagamento: 'recebido' } })).status, 404);
  assert.equal((await ctx.api('PUT', `/vendas-restaurantes/${venda.id}/pagamento`, { ...auth(), body: { status_pagamento: 'talvez' } })).status, 400);

  const filtradas = await ctx.api('GET', `/vendas-restaurantes?restaurante_id=${restaurante.id}&status_pagamento=pendente`, auth());
  assert.ok(filtradas.body.data.every((v) => v.status_pagamento === 'pendente'));
});

test('receitas manuais e despesas, com totais por filtro', async () => {
  const antes = (await ctx.api('GET', '/financeiro/entradas?origem=manual', auth())).body;
  const r = await ctx.api('POST', '/financeiro/entradas', { ...auth(), body: { descricao: 'Venda na feira', valor: 120.5, forma: 'dinheiro' } });
  assert.equal(r.status, 201);
  assert.equal(r.body.status, 'recebido');
  assert.equal(r.body.origem, 'manual');
  assert.equal(r.body.data, hoje());

  const p = await ctx.api('POST', '/financeiro/entradas', { ...auth(), body: { descricao: 'Encomenda buffet', valor: 300, status: 'pendente', data: '2026-10-01' } });
  assert.equal(p.body.status, 'pendente');

  // marcar recebida
  const recebida = await ctx.api('PUT', `/financeiro/entradas/${p.body.id}/status`, { ...auth(), body: { status: 'recebido', forma: 'pix' } });
  assert.equal(recebida.body.status, 'recebido');
  assert.equal(recebida.body.data, hoje());

  const depois = (await ctx.api('GET', '/financeiro/entradas?origem=manual', auth())).body;
  assert.equal(depois.totais.recebido - antes.totais.recebido, 420.5);

  assert.equal((await ctx.api('POST', '/financeiro/entradas', { ...auth(), body: { descricao: 'x', valor: 0 } })).status, 400);
  assert.equal((await ctx.api('POST', '/financeiro/entradas', { ...auth(), body: { valor: 10 } })).status, 400);
  assert.equal((await ctx.api('PUT', '/financeiro/entradas/9999/status', { ...auth(), body: { status: 'recebido' } })).status, 404);

  const s1 = await ctx.api('POST', '/financeiro/saidas', { ...auth(), body: { descricao: 'Chocolate', categoria: 'insumos', valor: 80.25, data: '2026-09-10' } });
  await ctx.api('POST', '/financeiro/saidas', { ...auth(), body: { descricao: 'Embalagens', categoria: 'Insumos', valor: 19.75, data: '2026-09-12' } });
  await ctx.api('POST', '/financeiro/saidas', { ...auth(), body: { descricao: 'Gás', categoria: 'contas', valor: 50, data: '2026-08-01' } });
  assert.equal(s1.status, 201);
  assert.equal(s1.body.data, '2026-09-10');

  const insumos = await ctx.api('GET', '/financeiro/saidas?categoria=insumos', auth());
  assert.equal(insumos.body.data.length, 2);
  assert.equal(insumos.body.totais.valor, 100);
  const periodo = await ctx.api('GET', '/financeiro/saidas?inicio=2026-09-11&fim=2026-09-30', auth());
  assert.equal(periodo.body.data.length, 1);
  assert.equal((await ctx.api('POST', '/financeiro/saidas', { ...auth(), body: { descricao: 'x', valor: -1 } })).status, 400);
  assert.equal((await ctx.api('POST', '/financeiro/saidas', { ...auth(), body: { descricao: 'x', valor: 1, data: '2026-02-31' } })).status, 400);
});

test('pedido confirmado gera entrada pendente; cancelar cancela a entrada pendente', async () => {
  const novo = async () => {
    const p = (await ctx.api('POST', '/pedidos', {
      body: { cliente: { nome: 'Cliente Teste', contato: 'cliente@teste.com' }, itens: [{ produto_id: produto.id, quantidade: 4 }] },
    })).body;
    const id = (await ctx.pool.query('SELECT id FROM pedidos WHERE numero_pedido = $1', [p.numero_pedido])).rows[0].id;
    return { numero: p.numero_pedido, id };
  };
  const mudar = (id, status) => ctx.api('PUT', `/pedidos/${id}/status`, { ...auth(), body: { status } });
  const entradaDe = async (numero) =>
    (await ctx.api('GET', '/financeiro/entradas?origem=pedido&limit=100', auth())).body.data.find((e) => e.numero_pedido === numero);

  const a = await novo();
  assert.equal(await entradaDe(a.numero), undefined); // ainda solicitado: nada lançado
  await mudar(a.id, 'confirmado');
  const e = await entradaDe(a.numero);
  assert.equal(e.valor, 12);
  assert.equal(e.status, 'pendente');
  await ctx.api('PUT', `/financeiro/entradas/${e.id}/status`, { ...auth(), body: { status: 'recebido', forma: 'pix' } });
  assert.equal((await entradaDe(a.numero)).status, 'recebido');

  const b = await novo();
  await mudar(b.id, 'confirmado');
  await mudar(b.id, 'cancelado');
  const eb = await entradaDe(b.numero);
  assert.equal(eb.status, 'cancelado');
  const tentativa = await ctx.api('PUT', `/financeiro/entradas/${eb.id}/status`, { ...auth(), body: { status: 'recebido' } });
  assert.equal(tentativa.status, 409);
  assert.equal(tentativa.body.erro.codigo, 'ENTRADA_CANCELADA');
});
