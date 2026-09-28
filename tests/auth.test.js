const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { setup } = require('./helpers');

let ctx;
before(async () => { ctx = await setup(); });
after(async () => { if (ctx) await ctx.teardown(); });

test('banco novo contém somente administradores e controle de migrations', async () => {
  const { rows } = await ctx.pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
  );
  assert.deepEqual(rows.map((r) => r.table_name), ['schema_migrations', 'usuarios_admin']);
});

test('migrations e cadastro inicial são idempotentes e preservam a administradora', async () => {
  const { migrate } = require('../src/db/migrate');
  const { ensureInitialAdmin } = require('../src/services/authService');
  const before = await ctx.pool.query('SELECT * FROM usuarios_admin');
  assert.equal(before.rowCount, 1);
  await Promise.all([migrate({ silent: true }), migrate({ silent: true })]);
  await ensureInitialAdmin();
  const after = await ctx.pool.query('SELECT * FROM usuarios_admin');
  assert.deepEqual(after.rows, before.rows);
  const { rows } = await ctx.pool.query('SELECT nome FROM schema_migrations');
  assert.deepEqual(rows, [{ nome: '004_autenticacao.sql' }]);
});

test('a senha fica armazenada somente como hash bcrypt válido', async () => {
  const { rows } = await ctx.pool.query('SELECT senha_hash FROM usuarios_admin');
  assert.notEqual(rows[0].senha_hash, process.env.ADMIN_SENHA);
  assert.match(rows[0].senha_hash, /^\$2[aby]\$/);
  assert.ok(await bcrypt.compare(process.env.ADMIN_SENHA, rows[0].senha_hash));
});

test('banco impede e-mails duplicados sem diferenciar maiúsculas', async () => {
  await assert.rejects(ctx.pool.query(
    `INSERT INTO usuarios_admin (nome, email, senha_hash)
     SELECT nome, upper(email), senha_hash FROM usuarios_admin`,
  ), { code: '23505' });
});

test('login retorna JWT assinado com identificador e expiração', async () => {
  const res = await ctx.api('POST', '/auth/login', {
    body: { email: process.env.ADMIN_EMAIL, senha: process.env.ADMIN_SENHA },
  });
  assert.equal(res.status, 200);
  const payload = jwt.verify(res.body.token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  assert.equal(payload.sub, String(res.body.admin.id));
  assert.equal(payload.exp - payload.iat, 8 * 60 * 60);
  assert.equal(res.body.tipo, 'Bearer');
  assert.equal(res.body.admin.email, process.env.ADMIN_EMAIL);
  assert.equal(res.body.admin.senha_hash, undefined);
  assert.equal(res.body.admin.senha, undefined);
});

test('login aceita e-mail em maiúsculas e com espaços nas extremidades', async () => {
  const res = await ctx.api('POST', '/auth/login', {
    body: { email: ` ${process.env.ADMIN_EMAIL.toUpperCase()} `, senha: process.env.ADMIN_SENHA },
  });
  assert.equal(res.status, 200);
});

test('senha incorreta e e-mail inexistente retornam o mesmo erro 401', async () => {
  const a = await ctx.api('POST', '/auth/login', { body: { email: process.env.ADMIN_EMAIL, senha: 'errada' } });
  const b = await ctx.api('POST', '/auth/login', { body: { email: 'nao@existe.com', senha: 'qualquer' } });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(a.body.erro.codigo, 'NAO_AUTENTICADO');
  assert.deepEqual(a.body, b.body);
});

test('login rejeita dados ausentes, inválidos e senhas acima do limite em bytes do bcrypt', async () => {
  for (const body of [undefined, {}, { email: 'invalido' },
    { email: process.env.ADMIN_EMAIL, senha: '' },
    { email: process.env.ADMIN_EMAIL, senha: 12345678 },
    { email: process.env.ADMIN_EMAIL, senha: 'á'.repeat(37) }]) {
    const res = await ctx.api('POST', '/auth/login', { body });
    assert.equal(res.status, 400);
    assert.equal(res.body.erro.codigo, 'REQUISICAO_INVALIDA');
    assert.ok(res.body.erro.detalhes.length);
  }
});

test('rota protegida recusa token ausente ou inválido e aceita token válido', async () => {
  assert.equal((await ctx.api('GET', '/auth/me')).status, 401);
  assert.equal((await ctx.api('GET', '/auth/me', { token: 'abc.def.ghi' })).status, 401);
  const res = await ctx.api('GET', '/auth/me', { token: ctx.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.email, process.env.ADMIN_EMAIL);
  assert.ok(res.body.criado_em);
  assert.equal(res.body.senha_hash, undefined);
});

test('rota protegida recusa token expirado, assinatura ou algoritmo incorretos e claims inválidos', async () => {
  const secret = process.env.JWT_SECRET;
  const payload = jwt.verify(ctx.token, secret);
  const tokens = [
    jwt.sign({}, secret, { subject: payload.sub, expiresIn: -1 }),
    jwt.sign({}, 'outra-chave', { subject: payload.sub, expiresIn: '1h' }),
    jwt.sign({}, secret, { subject: payload.sub, expiresIn: '1h', algorithm: 'HS384' }),
    jwt.sign({}, secret, { subject: payload.sub }),
    jwt.sign({}, secret, { expiresIn: '1h' }),
    jwt.sign({}, secret, { subject: 'abc', expiresIn: '1h' }),
    jwt.sign({}, secret, { subject: '2147483648', expiresIn: '1h' }),
    jwt.sign({}, secret, { subject: '2147483647', expiresIn: '1h' }),
  ];
  for (const token of tokens) {
    const res = await ctx.api('GET', '/auth/me', { token });
    assert.equal(res.status, 401);
    assert.equal(res.body.erro.codigo, 'NAO_AUTENTICADO');
  }
});

test('cabeçalho de autenticação malformado é recusado', async () => {
  for (const authorization of [`Basic ${ctx.token}`, 'Bearer', `Bearer ${ctx.token} extra`]) {
    const res = await fetch(`${ctx.base}/auth/me`, { headers: { Authorization: authorization } });
    assert.equal(res.status, 401);
  }
});

test('rotas das etapas futuras não estão disponíveis mesmo com token', async () => {
  for (const path of ['/produtos', '/estoque/movimentacao', '/pedidos', '/restaurantes',
    '/vendas-restaurantes', '/financeiro/entradas', '/financeiro/saidas', '/dashboard/resumo']) {
    for (const method of ['GET', 'POST']) {
      const res = await ctx.api(method, path, { token: ctx.token });
      assert.equal(res.status, 404, `${method} ${path}`);
    }
  }
});

test('health é público e retorna o estado da API', async () => {
  const res = await ctx.api('GET', '/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});

test('rota inexistente e JSON malformado retornam erros padronizados', async () => {
  const nf = await ctx.api('GET', '/nao-existe');
  assert.equal(nf.status, 404);
  assert.equal(nf.body.erro.codigo, 'ROTA_NAO_ENCONTRADA');
  const res = await fetch(`${ctx.base}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email": ',
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).erro.codigo, 'REQUISICAO_INVALIDA');
});

test('CORS responde ao preflight da origem configurada', async () => {
  const res = await fetch(`${ctx.base}/auth/login`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' },
  });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});

test('documentação contém apenas os endpoints da fase 2 e referências válidas', async () => {
  const res = await ctx.api('GET', '/docs/openapi.json');
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.body.paths).sort(), ['/auth/login', '/auth/me', '/health']);
  function checkRefs(value) {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) {
      const found = value.$ref.slice(2).split('/').reduce((obj, key) => obj?.[key], res.body);
      assert.ok(found, `Referência inexistente: ${value.$ref}`);
    }
    Object.values(value).forEach(checkRefs);
  }
  checkRefs(res.body);
  assert.equal((await ctx.api('GET', '/docs/openapi.yaml')).status, 200);
  const ui = await ctx.api('GET', '/docs/');
  assert.equal(ui.status, 200);
  assert.match(ui.body, /swagger-ui/);
});

test('primeiro cadastro recusa configuração inválida sem persistir administradora', async () => {
  const config = require('../src/config/env');
  const { ensureInitialAdmin } = require('../src/services/authService');
  const original = config.admin;
  // Este banco é exclusivo da execução dos testes.
  await ctx.pool.query('DELETE FROM usuarios_admin');
  try {
    for (const admin of [
      { ...original, email: undefined },
      { ...original, email: 'invalido' },
      { ...original, senha: 'curta' },
      { ...original, senha: 'á'.repeat(37) },
    ]) {
      config.admin = admin;
      await assert.rejects(ensureInitialAdmin(), /Configure ADMIN_NOME, ADMIN_EMAIL e ADMIN_SENHA/);
      assert.equal((await ctx.pool.query('SELECT id FROM usuarios_admin')).rowCount, 0);
    }
  } finally {
    config.admin = original;
    await ensureInitialAdmin();
  }
});
