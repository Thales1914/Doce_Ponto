// Helper dos testes de integração: sobe a API real contra um banco PostgreSQL dedicado (<POSTGRES_DB>_test).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-teste';
delete process.env.DATABASE_URL;
process.env.POSTGRES_USER = process.env.POSTGRES_USER || 'doces';
process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'doces';
const baseDb = process.env.POSTGRES_DB || 'doces';
const testDb = baseDb.endsWith('_test') ? baseDb : `${baseDb}_test`;
process.env.POSTGRES_DB = testDb;
process.env.ADMIN_EMAIL = 'admin@teste.local';
process.env.ADMIN_SENHA = 'senha-de-teste';
process.env.ADMIN_NOME = 'Admin Teste';

const { Client } = require('pg');

async function ensureTestDatabase() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: 'postgres',
  });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [testDb]);
    if (!rowCount) await client.query(`CREATE DATABASE "${testDb}"`);
  } finally {
    await client.end();
  }
}

/** Prepara banco limpo + servidor HTTP em porta efêmera. Retorna helpers de requisição. */
async function setup() {
  await ensureTestDatabase();
  const { pool } = require('../src/db/pool');
  const { migrate } = require('../src/db/migrate');
  const { ensureInitialAdmin } = require('../src/services/authService');
  const app = require('../src/app');

  await migrate({ silent: true });
  await pool.query(`
    TRUNCATE usuarios_admin, clientes, produtos, estoque_movimentacoes, pedidos, itens_pedido,
             pedido_status_historico, pedido_observacoes, restaurantes, vendas_restaurantes,
             financeiro_entradas, financeiro_saidas RESTART IDENTITY CASCADE`);
  await ensureInitialAdmin();

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;

  async function api(method, path, { body, token } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, body: json };
  }

  const login = async () => {
    const { body } = await api('POST', '/auth/login', {
      body: { email: process.env.ADMIN_EMAIL, senha: process.env.ADMIN_SENHA },
    });
    return body.token;
  };

  return {
    api,
    base,
    pool,
    token: await login(),
    async teardown() {
      await new Promise((r) => server.close(r));
      await pool.end();
    },
  };
}

module.exports = { setup };
