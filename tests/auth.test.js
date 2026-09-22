const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers');

let ctx;
before(async () => {
  ctx = await setup();
});
after(() => ctx.teardown());

test('migrations criaram todas as tabelas do DER', async () => {
  const { rows } = await ctx.pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  const tabelas = rows.map((r) => r.table_name);
  for (const t of [
    'usuarios_admin', 'clientes', 'produtos', 'estoque_movimentacoes', 'pedidos', 'itens_pedido',
    'restaurantes', 'vendas_restaurantes', 'financeiro_entradas', 'financeiro_saidas',
    'pedido_status_historico', 'pedido_observacoes',
  ]) {
    assert.ok(tabelas.includes(t), `tabela ausente: ${t}`);
  }
});

test('a senha da administradora é armazenada com hash', async () => {
  const { rows } = await ctx.pool.query('SELECT senha_hash FROM usuarios_admin');
  assert.notEqual(rows[0].senha_hash, process.env.ADMIN_SENHA);
  assert.match(rows[0].senha_hash, /^\$2[aby]\$/);
});

test('login com credenciais corretas retorna token JWT', async () => {
  const res = await ctx.api('POST', '/auth/login', {
    body: { email: process.env.ADMIN_EMAIL, senha: process.env.ADMIN_SENHA },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.token.split('.').length, 3);
  assert.equal(res.body.admin.email, process.env.ADMIN_EMAIL);
  assert.equal(res.body.admin.senha_hash, undefined);
});

test('login com senha errada ou e-mail inexistente retorna 401', async () => {
  const a = await ctx.api('POST', '/auth/login', { body: { email: process.env.ADMIN_EMAIL, senha: 'errada' } });
  const b = await ctx.api('POST', '/auth/login', { body: { email: 'nao@existe.com', senha: 'qualquer' } });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(a.body.erro.codigo, 'NAO_AUTENTICADO');
});

test('login valida o corpo da requisição', async () => {
  const res = await ctx.api('POST', '/auth/login', { body: { email: 'invalido' } });
  assert.equal(res.status, 400);
  assert.equal(res.body.erro.codigo, 'REQUISICAO_INVALIDA');
  assert.ok(res.body.erro.detalhes.length >= 1);
});

test('rota protegida recusa acesso sem token, com token inválido e aceita token válido', async () => {
  const sem = await ctx.api('GET', '/auth/me');
  const invalido = await ctx.api('GET', '/auth/me', { token: 'abc.def.ghi' });
  const ok = await ctx.api('GET', '/auth/me', { token: ctx.token });
  assert.equal(sem.status, 401);
  assert.equal(invalido.status, 401);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.email, process.env.ADMIN_EMAIL);
});

test('rota inexistente e JSON malformado retornam erros padronizados', async () => {
  const nf = await ctx.api('GET', '/nao-existe');
  assert.equal(nf.status, 404);
  assert.equal(nf.body.erro.codigo, 'ROTA_NAO_ENCONTRADA');

  const res = await fetch(`${ctx.base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"email": ',
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).erro.codigo, 'REQUISICAO_INVALIDA');
});

test('CORS libera o frontend e responde ao preflight', async () => {
  const res = await fetch(`${ctx.base}/produtos`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET' },
  });
  assert.equal(res.status, 204);
  assert.ok(res.headers.get('access-control-allow-origin'));
});
