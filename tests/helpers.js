// Cada execução cria e remove seu próprio banco; o banco da aplicação não é alterado.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'segredo-exclusivo-dos-testes-de-autenticacao';
process.env.JWT_EXPIRES_IN = '8h';
process.env.CORS_ORIGIN = 'http://localhost:5173';
delete process.env.DATABASE_URL;
process.env.POSTGRES_USER = process.env.POSTGRES_USER || 'doces';
process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'doces';
const { randomBytes } = require('node:crypto');
const testDb = `doces_fase2_test_${process.pid}_${randomBytes(6).toString('hex')}`;
process.env.POSTGRES_DB = testDb;
process.env.ADMIN_EMAIL = 'admin@teste.local';
process.env.ADMIN_SENHA = 'senha-de-teste';
process.env.ADMIN_NOME = 'Admin Teste';

const { Client } = require('pg');
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: 'postgres',
  connectionTimeoutMillis: 5000,
};

async function databaseCommand(sql) {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    await client.query(sql);
  } finally {
    await client.end();
  }
}

async function setup() {
  await databaseCommand(`CREATE DATABASE "${testDb}"`);
  const { pool } = require('../src/db/pool');
  let server;
  async function teardown() {
    try {
      if (server) await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    } finally {
      await pool.end();
      await databaseCommand(`DROP DATABASE "${testDb}"`);
    }
  }

  try {
    const { migrate } = require('../src/db/migrate');
    const { ensureInitialAdmin } = require('../src/services/authService');
    const app = require('../src/app');
    await migrate({ silent: true });
    // Exercita a criação concorrente da mesma administradora no primeiro boot.
    await Promise.all([ensureInitialAdmin(), ensureInitialAdmin()]);
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
      listener.once('error', reject);
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
      let json;
      try { json = JSON.parse(text); } catch { json = text; }
      return { status: res.status, body: json };
    }

    const login = await api('POST', '/auth/login', {
      body: { email: process.env.ADMIN_EMAIL, senha: process.env.ADMIN_SENHA },
    });
    if (login.status !== 200 || !login.body.token) throw new Error('Falha no login de preparação dos testes.');
    return { api, base, pool, token: login.body.token, teardown };
  } catch (err) {
    await teardown();
    throw err;
  }
}

module.exports = { setup };
