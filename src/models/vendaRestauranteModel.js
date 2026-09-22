const insert = async (db, { restauranteId, produtoId, quantidade, valorTotal }) => {
  const { rows } = await db.query(
    `INSERT INTO vendas_restaurantes (restaurante_id, produto_id, quantidade, valor_total)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [restauranteId, produtoId, quantidade, valorTotal],
  );
  return rows[0].id;
};

const SELECT = `
  SELECT v.id, v.restaurante_id, r.nome AS restaurante_nome, v.produto_id, p.nome AS produto_nome,
         v.quantidade, v.valor_total, v.status_pagamento, v.criado_em
    FROM vendas_restaurantes v
    JOIN restaurantes r ON r.id = v.restaurante_id
    JOIN produtos p ON p.id = v.produto_id`;

const findById = async (db, id, { forUpdate = false } = {}) => {
  if (forUpdate) await db.query('SELECT 1 FROM vendas_restaurantes WHERE id = $1 FOR UPDATE', [id]);
  const { rows } = await db.query(`${SELECT} WHERE v.id = $1`, [id]);
  return rows[0] || null;
};

const updateStatusPagamento = async (db, id, status) => {
  await db.query('UPDATE vendas_restaurantes SET status_pagamento = $2 WHERE id = $1', [id, status]);
};

const list = async (db, { restaurante_id, status_pagamento, inicio, fim, limit, offset }) => {
  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (restaurante_id) add('v.restaurante_id = ?', restaurante_id);
  if (status_pagamento) add('v.status_pagamento = ?', status_pagamento);
  if (inicio) add('v.criado_em::date >= ?', inicio);
  if (fim) add('v.criado_em::date <= ?', fim);
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows: total } = await db.query(`SELECT count(*) AS total FROM vendas_restaurantes v ${clause}`, params);
  params.push(limit, offset);
  const { rows } = await db.query(
    `${SELECT} ${clause} ORDER BY v.criado_em DESC, v.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { rows, total: total[0].total };
};

module.exports = { insert, findById, updateStatusPagamento, list };
