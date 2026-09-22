/** Identificação simples: o contato (case-insensitive) identifica o cliente; reutiliza se já existir. */
const findOrCreate = async (db, { nome, contato }) => {
  const { rows } = await db.query(
    `INSERT INTO clientes (nome, contato) VALUES ($1, $2)
     ON CONFLICT ((lower(contato))) DO UPDATE SET contato = clientes.contato
     RETURNING id, nome, contato`,
    [nome, contato],
  );
  return rows[0];
};

module.exports = { findOrCreate };
