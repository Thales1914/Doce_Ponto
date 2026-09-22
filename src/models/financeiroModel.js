const ENTRADA_SELECT = `
  SELECT e.id, e.pedido_id, p.numero_pedido, e.venda_restaurante_id, r.nome AS restaurante_nome,
         e.descricao, e.valor, e.forma, e.status, e.data, e.criado_em,
         CASE WHEN e.pedido_id IS NOT NULL THEN 'pedido'
              WHEN e.venda_restaurante_id IS NOT NULL THEN 'venda_restaurante'
              ELSE 'manual' END AS origem
    FROM financeiro_entradas e
    LEFT JOIN pedidos p ON p.id = e.pedido_id
    LEFT JOIN vendas_restaurantes v ON v.id = e.venda_restaurante_id
    LEFT JOIN restaurantes r ON r.id = v.restaurante_id`;

const insertEntrada = async (db, { pedidoId, vendaId, descricao, valor, forma, status, data }) => {
  const { rows } = await db.query(
    `INSERT INTO financeiro_entradas (pedido_id, venda_restaurante_id, descricao, valor, forma, status, data)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::date, CURRENT_DATE))
     RETURNING id`,
    [pedidoId ?? null, vendaId ?? null, descricao ?? null, valor, forma ?? null, status ?? 'pendente', data ?? null],
  );
  return findEntradaById(db, rows[0].id);
};

const findEntradaById = async (db, id, { forUpdate = false } = {}) => {
  if (forUpdate) {
    // FOR UPDATE não combina com os LEFT JOINs: trava só a linha da entrada
    await db.query('SELECT 1 FROM financeiro_entradas WHERE id = $1 FOR UPDATE', [id]);
  }
  const { rows } = await db.query(`${ENTRADA_SELECT} WHERE e.id = $1`, [id]);
  return rows[0] || null;
};

const findEntradaByVenda = async (db, vendaId) => {
  const { rows } = await db.query('SELECT id FROM financeiro_entradas WHERE venda_restaurante_id = $1', [vendaId]);
  return rows[0] || null;
};

/** Marca como recebido/pendente. Recebido: `data` (ou hoje) vira a data do recebimento. */
const updateEntradaStatus = async (db, id, { status, forma, data }) => {
  await db.query(
    `UPDATE financeiro_entradas
        SET status = $2::varchar,
            forma = COALESCE($3::varchar, forma),
            data = CASE WHEN $2::varchar = 'recebido' THEN COALESCE($4::date, CURRENT_DATE) ELSE COALESCE($4::date, data) END
      WHERE id = $1`,
    [id, status, forma ?? null, data ?? null],
  );
  return findEntradaById(db, id);
};

/** Entrada pendente de um pedido cancelado deixa de contar como valor a receber. */
const cancelarEntradaPendenteDoPedido = async (db, pedidoId) => {
  await db.query(
    "UPDATE financeiro_entradas SET status = 'cancelado' WHERE pedido_id = $1 AND status = 'pendente'",
    [pedidoId],
  );
};

const listEntradas = async (db, { status, origem, inicio, fim, limit, offset }) => {
  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (status) add('e.status = ?', status);
  if (inicio) add('e.data >= ?', inicio);
  if (fim) add('e.data <= ?', fim);
  if (origem === 'pedido') where.push('e.pedido_id IS NOT NULL');
  if (origem === 'venda_restaurante') where.push('e.venda_restaurante_id IS NOT NULL');
  if (origem === 'manual') where.push('e.pedido_id IS NULL AND e.venda_restaurante_id IS NULL');
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows: totais } = await db.query(
    `SELECT e.status, count(*) AS quantidade, COALESCE(sum(e.valor), 0) AS valor
       FROM financeiro_entradas e ${clause} GROUP BY e.status`,
    params,
  );
  params.push(limit, offset);
  const { rows } = await db.query(
    `${ENTRADA_SELECT} ${clause} ORDER BY e.data DESC, e.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { rows, totais };
};

const insertSaida = async (db, { descricao, categoria, valor, data }) => {
  const { rows } = await db.query(
    `INSERT INTO financeiro_saidas (descricao, categoria, valor, data)
     VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE))
     RETURNING id, descricao, categoria, valor, data, criado_em`,
    [descricao, categoria ?? null, valor, data ?? null],
  );
  return rows[0];
};

const listSaidas = async (db, { categoria, inicio, fim, limit, offset }) => {
  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (categoria) add('categoria ILIKE ?', categoria);
  if (inicio) add('data >= ?', inicio);
  if (fim) add('data <= ?', fim);
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows: soma } = await db.query(
    `SELECT count(*) AS quantidade, COALESCE(sum(valor), 0) AS valor FROM financeiro_saidas ${clause}`,
    params,
  );
  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT id, descricao, categoria, valor, data, criado_em FROM financeiro_saidas ${clause}
      ORDER BY data DESC, id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { rows, total: soma[0].quantidade, valorTotal: soma[0].valor };
};

module.exports = {
  insertEntrada, findEntradaById, findEntradaByVenda, updateEntradaStatus,
  cancelarEntradaPendenteDoPedido, listEntradas, insertSaida, listSaidas,
};
