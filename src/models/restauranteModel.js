const COLUNAS = 'id, nome, contato, criado_em';

const list = async (db, { busca } = {}) => {
  const { rows } = await db.query(
    `SELECT ${COLUNAS} FROM restaurantes ${busca ? 'WHERE nome ILIKE $1' : ''} ORDER BY nome, id`,
    busca ? [`%${busca}%`] : [],
  );
  return rows;
};

const findById = async (db, id) => {
  const { rows } = await db.query(`SELECT ${COLUNAS} FROM restaurantes WHERE id = $1`, [id]);
  return rows[0] || null;
};

const create = async (db, { nome, contato }) => {
  const { rows } = await db.query(
    `INSERT INTO restaurantes (nome, contato) VALUES ($1, $2) RETURNING ${COLUNAS}`,
    [nome, contato ?? null],
  );
  return rows[0];
};

const update = async (db, id, { nome, contato }) => {
  const { rows } = await db.query(
    `UPDATE restaurantes SET nome = COALESCE($2, nome), contato = CASE WHEN $4 THEN $3 ELSE contato END
      WHERE id = $1 RETURNING ${COLUNAS}`,
    [id, nome ?? null, contato ?? null, contato !== undefined],
  );
  return rows[0] || null;
};

module.exports = { list, findById, create, update };
