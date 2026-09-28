const { Pool } = require('pg');
const config = require('../config/env');

const pool = new Pool({ ...config.db, connectionTimeoutMillis: 5000 });

pool.on('error', (err) => {
  console.error('Erro inesperado no pool do PostgreSQL:', err.message);
});

/** Executa `fn(client)` dentro de uma transação (commit ao final, rollback em erro). */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, withTransaction };
