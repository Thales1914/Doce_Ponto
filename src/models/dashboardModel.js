/** Consultas agregadas do dashboard. `inicio`/`fim` são datas YYYY-MM-DD (inclusivas). */

const vendasPedidos = async (db, { inicio, fim }) => {
  // pedido "vendido" = entrada financeira do pedido (gerada na confirmação), exceto cancelada
  const { rows } = await db.query(
    `SELECT count(*) AS quantidade, COALESCE(sum(valor), 0) AS valor
       FROM financeiro_entradas
      WHERE pedido_id IS NOT NULL AND status <> 'cancelado' AND criado_em::date BETWEEN $1 AND $2`,
    [inicio, fim],
  );
  return rows[0];
};

const vendasRestaurantes = async (db, { inicio, fim }) => {
  const { rows } = await db.query(
    `SELECT count(*) AS quantidade, COALESCE(sum(valor_total), 0) AS valor
       FROM vendas_restaurantes WHERE criado_em::date BETWEEN $1 AND $2`,
    [inicio, fim],
  );
  return rows[0];
};

const vendasPorDia = async (db, { inicio, fim }) => {
  const { rows } = await db.query(
    `SELECT dia::text AS data, sum(valor) AS valor FROM (
        SELECT criado_em::date AS dia, valor FROM financeiro_entradas
         WHERE pedido_id IS NOT NULL AND status <> 'cancelado' AND criado_em::date BETWEEN $1 AND $2
        UNION ALL
        SELECT criado_em::date AS dia, valor_total AS valor FROM vendas_restaurantes
         WHERE criado_em::date BETWEEN $1 AND $2
      ) v GROUP BY dia ORDER BY dia`,
    [inicio, fim],
  );
  return rows;
};

const recebimentos = async (db, { inicio, fim }) => {
  const { rows } = await db.query(
    `SELECT count(*) AS quantidade, COALESCE(sum(valor), 0) AS valor
       FROM financeiro_entradas WHERE status = 'recebido' AND data BETWEEN $1 AND $2`,
    [inicio, fim],
  );
  return rows[0];
};

/** Pendências são um saldo em aberto: não dependem do período. */
const pendencias = async (db) => {
  const { rows } = await db.query(
    `SELECT CASE WHEN pedido_id IS NOT NULL THEN 'pedidos'
                 WHEN venda_restaurante_id IS NOT NULL THEN 'restaurantes'
                 ELSE 'manual' END AS origem,
            count(*) AS quantidade, sum(valor) AS valor
       FROM financeiro_entradas WHERE status = 'pendente' GROUP BY 1`,
  );
  return rows;
};

const despesas = async (db, { inicio, fim }) => {
  const { rows } = await db.query(
    `SELECT count(*) AS quantidade, COALESCE(sum(valor), 0) AS valor
       FROM financeiro_saidas WHERE data BETWEEN $1 AND $2`,
    [inicio, fim],
  );
  return rows[0];
};

const estoqueAtual = async (db) => {
  const { rows } = await db.query(
    'SELECT id, nome, quantidade_disponivel FROM produtos WHERE ativo ORDER BY nome, id',
  );
  return rows;
};

const pedidosPorStatus = async (db, { inicio, fim }) => {
  const { rows } = await db.query(
    'SELECT status, count(*) AS quantidade FROM pedidos WHERE criado_em::date BETWEEN $1 AND $2 GROUP BY status',
    [inicio, fim],
  );
  return rows;
};

module.exports = {
  vendasPedidos, vendasRestaurantes, vendasPorDia, recebimentos, pendencias, despesas, estoqueAtual, pedidosPorStatus,
};
