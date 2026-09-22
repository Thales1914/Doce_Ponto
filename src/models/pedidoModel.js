const COLUNAS = 'id, numero_pedido, cliente_id, status, observacoes, estoque_baixado, criado_em, atualizado_em';

/** Insere o pedido; devolve null se o número já existir (o service tenta outro). */
const insert = async (db, { numeroPedido, clienteId, observacoes }) => {
  const { rows } = await db.query(
    `INSERT INTO pedidos (numero_pedido, cliente_id, observacoes) VALUES ($1, $2, $3)
     ON CONFLICT (numero_pedido) DO NOTHING
     RETURNING ${COLUNAS}`,
    [numeroPedido, clienteId, observacoes ?? null],
  );
  return rows[0] || null;
};

const insertItens = async (db, pedidoId, itens) => {
  for (const item of itens) {
    await db.query(
      'INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario) VALUES ($1, $2, $3, $4)',
      [pedidoId, item.produto_id, item.quantidade, item.preco_unitario],
    );
  }
};

const insertHistorico = async (db, { pedidoId, statusAnterior, statusNovo, adminId, observacao }) => {
  await db.query(
    `INSERT INTO pedido_status_historico (pedido_id, status_anterior, status_novo, admin_id, observacao)
     VALUES ($1, $2, $3, $4, $5)`,
    [pedidoId, statusAnterior ?? null, statusNovo, adminId ?? null, observacao ?? null],
  );
};

const findById = async (db, id, { forUpdate = false } = {}) => {
  const { rows } = await db.query(`SELECT ${COLUNAS} FROM pedidos WHERE id = $1 ${forUpdate ? 'FOR UPDATE' : ''}`, [id]);
  return rows[0] || null;
};

const findByNumero = async (db, numero) => {
  const { rows } = await db.query(`SELECT ${COLUNAS} FROM pedidos WHERE numero_pedido = $1`, [numero]);
  return rows[0] || null;
};

const findItens = async (db, pedidoId) => {
  const { rows } = await db.query(
    `SELECT i.produto_id, p.nome AS produto_nome, i.quantidade, i.preco_unitario,
            round(i.quantidade * i.preco_unitario, 2) AS subtotal
       FROM itens_pedido i JOIN produtos p ON p.id = i.produto_id
      WHERE i.pedido_id = $1 ORDER BY i.id`,
    [pedidoId],
  );
  return rows;
};

const findHistorico = async (db, pedidoId) => {
  const { rows } = await db.query(
    `SELECT h.status_anterior, h.status_novo, h.observacao, h.admin_id, u.nome AS admin_nome, h.criado_em
       FROM pedido_status_historico h LEFT JOIN usuarios_admin u ON u.id = h.admin_id
      WHERE h.pedido_id = $1 ORDER BY h.id`,
    [pedidoId],
  );
  return rows;
};

const findObservacoes = async (db, pedidoId) => {
  const { rows } = await db.query(
    'SELECT texto, criado_em FROM pedido_observacoes WHERE pedido_id = $1 ORDER BY id',
    [pedidoId],
  );
  return rows;
};

const insertObservacao = async (db, pedidoId, texto) => {
  const { rows } = await db.query(
    'INSERT INTO pedido_observacoes (pedido_id, texto) VALUES ($1, $2) RETURNING texto, criado_em',
    [pedidoId, texto],
  );
  return rows[0];
};

const updateStatus = async (db, id, { status, estoqueBaixado }) => {
  const { rows } = await db.query(
    `UPDATE pedidos SET status = $2, estoque_baixado = COALESCE($3, estoque_baixado), atualizado_em = now()
      WHERE id = $1 RETURNING ${COLUNAS}`,
    [id, status, estoqueBaixado ?? null],
  );
  return rows[0];
};

const findCliente = async (db, clienteId) => {
  const { rows } = await db.query('SELECT id, nome, contato FROM clientes WHERE id = $1', [clienteId]);
  return rows[0];
};

const list = async (db, { status, cliente_id, cliente, inicio, fim, limit, offset }) => {
  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };
  if (status) add('p.status = ?', status);
  if (cliente_id) add('p.cliente_id = ?', cliente_id);
  if (cliente) add('(c.nome ILIKE ? OR c.contato ILIKE ?)', `%${cliente}%`);
  if (inicio) add('p.criado_em::date >= ?', inicio);
  if (fim) add('p.criado_em::date <= ?', fim);
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows: total } = await db.query(
    `SELECT count(*) AS total FROM pedidos p JOIN clientes c ON c.id = p.cliente_id ${clause}`,
    params,
  );
  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT p.id, p.numero_pedido, p.status, p.observacoes, p.criado_em, p.atualizado_em,
            c.id AS cliente_id, c.nome AS cliente_nome, c.contato AS cliente_contato,
            COALESCE(t.total, 0) AS total, COALESCE(t.itens, 0) AS quantidade_itens
       FROM pedidos p
       JOIN clientes c ON c.id = p.cliente_id
       LEFT JOIN LATERAL (
         SELECT round(sum(i.quantidade * i.preco_unitario), 2) AS total, sum(i.quantidade) AS itens
           FROM itens_pedido i WHERE i.pedido_id = p.id
       ) t ON true
       ${clause}
      ORDER BY p.criado_em DESC, p.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { rows, total: total[0].total };
};

module.exports = {
  insert, insertItens, insertHistorico, findById, findByNumero, findItens, findHistorico,
  findObservacoes, insertObservacao, updateStatus, findCliente, list,
};
