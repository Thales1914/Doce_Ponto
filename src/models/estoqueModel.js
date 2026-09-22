const COLUNAS = `id, produto_id, tipo, quantidade, saldo_anterior, saldo_posterior, motivo,
                 pedido_id, venda_restaurante_id, criado_em`;

const insert = async (db, m) => {
  const { rows } = await db.query(
    `INSERT INTO estoque_movimentacoes
       (produto_id, tipo, quantidade, saldo_anterior, saldo_posterior, motivo, pedido_id, venda_restaurante_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${COLUNAS}`,
    [m.produtoId, m.tipo, m.quantidade, m.saldoAnterior, m.saldoPosterior, m.motivo ?? null, m.pedidoId ?? null, m.vendaId ?? null],
  );
  return rows[0];
};

const list = async (db, { produto_id, tipo, inicio, fim, limit, offset }) => {
  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (produto_id) add('m.produto_id = ?', produto_id);
  if (tipo) add('m.tipo = ?', tipo);
  if (inicio) add('m.criado_em::date >= ?', inicio);
  if (fim) add('m.criado_em::date <= ?', fim);
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows: total } = await db.query(`SELECT count(*) AS total FROM estoque_movimentacoes m ${clause}`, params);
  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT m.id, m.produto_id, p.nome AS produto_nome, m.tipo, m.quantidade, m.saldo_anterior,
            m.saldo_posterior, m.motivo, m.pedido_id, m.venda_restaurante_id, m.criado_em
       FROM estoque_movimentacoes m JOIN produtos p ON p.id = m.produto_id
       ${clause}
      ORDER BY m.criado_em DESC, m.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { rows, total: total[0].total };
};

module.exports = { insert, list };
