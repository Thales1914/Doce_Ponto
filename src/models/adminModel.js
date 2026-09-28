const findByEmail = async (db, email) => {
  const { rows } = await db.query(
    'SELECT id, nome, email, senha_hash FROM usuarios_admin WHERE lower(email) = lower($1)',
    [email],
  );
  return rows[0] || null;
};

const findById = async (db, id) => {
  const { rows } = await db.query('SELECT id, nome, email, criado_em FROM usuarios_admin WHERE id = $1', [id]);
  return rows[0] || null;
};

const create = async (db, { nome, email, senhaHash }) => {
  const { rows } = await db.query(
    `INSERT INTO usuarios_admin (nome, email, senha_hash) VALUES ($1, $2, $3)
     RETURNING id, nome, email, criado_em`,
    [nome, email, senhaHash],
  );
  return rows[0];
};

const count = async (db) => {
  const { rows } = await db.query('SELECT count(*)::integer AS total FROM usuarios_admin');
  return rows[0].total;
};

module.exports = { findByEmail, findById, create, count };
