const { Pool, types } = require('pg');
const config = require('../config/env');

// NUMERIC -> number (valores monetários, escala 2), DATE -> 'YYYY-MM-DD' (sem fuso), INT8 (COUNT/SUM) -> number
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(1082, (v) => v);
types.setTypeParser(20, (v) => parseInt(v, 10));

const pool = new Pool(config.db);

// Datas/horas sempre interpretadas no fuso da aplicação
pool.on('connect', (client) => {
  client.query(`SET TIME ZONE '${config.timezone.replace(/'/g, '')}'`);
});

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
