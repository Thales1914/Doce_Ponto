const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers');

let ctx;
let produto;

before(async () => {
  ctx = await setup();
  produto = (
    await ctx.api('POST', '/produtos', { token: ctx.token, body: { nome: 'Brigadeiro', preco: 3.5, quantidade_disponivel: 100 } })
  ).body;
});
after(() => ctx.teardown());

const pedido = () => ({
  cliente: { nome: 'Ana Souza', contato: 'ana@email.com' },
  itens: [{ produto_id: produto.id, quantidade: 12 }],
  observacoes: 'Sem granulado',
});

test('[MARCO Fase 6] fluxo completo: cliente pede, admin atualiza, cliente vê o andamento', async () => {
  // 1. cliente cria o pedido (sem login) e recebe o número
  const criado = await ctx.api('POST', '/pedidos', { body: pedido() });
  assert.equal(criado.status, 201);
  const numero = criado.body.numero_pedido;

  // 2. cliente consulta: solicitado
  let ac = await ctx.api('GET', `/pedidos/${numero}`);
  assert.equal(ac.status, 200);
  assert.equal(ac.body.status, 'solicitado');
  assert.equal(ac.body.total, 42);
  assert.deepEqual(ac.body.historico.map((h) => h.status), ['solicitado']);

  // 3. admin localiza o pedido na listagem e avança o status
  const lista = await ctx.api('GET', `/pedidos?status=solicitado&cliente=ana`, { token: ctx.token });
  const item = lista.body.data.find((p) => p.numero_pedido === numero);
  assert.ok(item);
  assert.equal((await ctx.api('PUT', `/pedidos/${item.id}/status`, { token: ctx.token, body: { status: 'confirmado', observacao: 'nota interna' } })).status, 200);
  assert.equal((await ctx.api('PUT', `/pedidos/${item.id}/status`, { token: ctx.token, body: { status: 'em_producao' } })).status, 200);

  // 4. cliente vê o andamento refletido (sem a nota interna nem dados pessoais)
  ac = await ctx.api('GET', `/pedidos/${numero}`);
  assert.equal(ac.body.status, 'em_producao');
  assert.equal(ac.body.status_descricao, 'Em produção');
  assert.deepEqual(ac.body.historico.map((h) => h.status), ['solicitado', 'confirmado', 'em_producao']);
  const json = JSON.stringify(ac.body);
  assert.ok(!json.includes('nota interna'));
  assert.ok(!json.includes('ana@email.com'));
  assert.equal(ac.body.cliente, undefined);

  // 5. cliente inclui observação adicional; admin enxerga
  const obs = await ctx.api('POST', `/pedidos/${numero}/observacoes`, { body: { texto: 'Pode entregar no portão' } });
  assert.equal(obs.status, 201);
  ac = await ctx.api('GET', `/pedidos/${numero}`);
  assert.equal(ac.body.observacoes_adicionais[0].texto, 'Pode entregar no portão');
  const det = await ctx.api('GET', `/pedidos/${item.id}/detalhes`, { token: ctx.token });
  assert.equal(det.body.observacoes_adicionais.length, 1);

  // 6. pedido entregue: consulta continua, novas observações são recusadas
  for (const s of ['pronto', 'entregue']) {
    await ctx.api('PUT', `/pedidos/${item.id}/status`, { token: ctx.token, body: { status: s } });
  }
  assert.equal((await ctx.api('GET', `/pedidos/${numero}`)).body.status, 'entregue');
  const tarde = await ctx.api('POST', `/pedidos/${numero}/observacoes`, { body: { texto: 'tarde demais' } });
  assert.equal(tarde.status, 409);
  assert.equal(tarde.body.erro.codigo, 'PEDIDO_FINALIZADO');
});

test('[Fase 6] consulta aceita o número em minúsculas; número inexistente é 404; formato inválido é 400', async () => {
  const { numero_pedido } = (await ctx.api('POST', '/pedidos', { body: pedido() })).body;
  assert.equal((await ctx.api('GET', `/pedidos/${numero_pedido.toLowerCase()}`)).status, 200);
  assert.equal((await ctx.api('GET', '/pedidos/PED-AAAAAAAA')).status, 404);
  assert.equal((await ctx.api('GET', '/pedidos/1')).status, 400);
  assert.equal((await ctx.api('GET', "/pedidos/PED-'%20OR%201=1")).status, 400);
});

test('[Fase 6] validação da observação do cliente', async () => {
  const { numero_pedido } = (await ctx.api('POST', '/pedidos', { body: pedido() })).body;
  assert.equal((await ctx.api('POST', `/pedidos/${numero_pedido}/observacoes`, { body: { texto: '   ' } })).status, 400);
  assert.equal((await ctx.api('POST', `/pedidos/${numero_pedido}/observacoes`, { body: { texto: 'x'.repeat(1001) } })).status, 400);
  assert.equal((await ctx.api('POST', '/pedidos/PED-AAAAAAAA/observacoes', { body: { texto: 'oi' } })).status, 404);
});
