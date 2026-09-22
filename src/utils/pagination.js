/** Monta a resposta paginada padrão: { data, meta: { page, limit, total, total_paginas } } */
function paginated(data, total, { page, limit }) {
  return { data, meta: { page, limit, total, total_paginas: Math.ceil(total / limit) } };
}

const offset = ({ page, limit }) => (page - 1) * limit;

module.exports = { paginated, offset };
