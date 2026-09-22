const COLUNAS = 'id, nome, descricao, preco, quantidade_disponivel, ativo, criado_em, atualizado_em';

const list = async (db, { ativo, busca } = {}) => {
  const where = [];
  const params = [];
  if (ativo !== undefined) {
    params.push(ativo);
    where.push(`ativo = $${params.length}`);
  }
  if (busca) {
    params.push(`%${busca}%`);
    where.push(`nome ILIKE $${params.length}`);
  }
  const { rows } = await db.query(
    `SELECT ${COLUNAS} FROM produtos ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY nome, id`,
    params,
  );
  return rows;
};

const findById = async (db, id, { forUpdate = false } = {}) => {
  const { rows } = await db.query(
    `SELECT ${COLUNAS} FROM produtos WHERE id = $1 ${forUpdate ? 'FOR UPDATE' : ''}`,
    [id],
  );
  return rows[0] || null;
};

const findByIds = async (db, ids) => {
  const { rows } = await db.query(`SELECT ${COLUNAS} FROM produtos WHERE id = ANY($1::int[])`, [ids]);
  return rows;
};

const create = async (db, { nome, descricao, preco, ativo }) => {
  const { rows } = await db.query(
    `INSERT INTO produtos (nome, descricao, preco, ativo) VALUES ($1, $2, $3, $4) RETURNING ${COLUNAS}`,
    [nome, descricao ?? null, preco, ativo],
  );
  return rows[0];
};

const update = async (db, id, campos) => {
  const sets = [];
  const params = [id];
  for (const col of ['nome', 'descricao', 'preco', 'ativo']) {
    if (campos[col] !== undefined) {
      params.push(campos[col]);
      sets.push(`${col} = $${params.length}`);
    }
  }
  sets.push('atualizado_em = now()');
  const { rows } = await db.query(`UPDATE produtos SET ${sets.join(', ')} WHERE id = $1 RETURNING ${COLUNAS}`, params);
  return rows[0] || null;
};

const setSaldo = async (db, id, saldo) => {
  await db.query('UPDATE produtos SET quantidade_disponivel = $2, atualizado_em = now() WHERE id = $1', [id, saldo]);
};

module.exports = { list, findById, findByIds, create, update, setSaldo };
