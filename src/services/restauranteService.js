const { pool } = require('../db/pool');
const AppError = require('../utils/AppError');
const restauranteModel = require('../models/restauranteModel');

const listar = (filtros) => restauranteModel.list(pool, filtros);
const criar = (dados) => restauranteModel.create(pool, dados);

async function atualizar(id, dados) {
  const restaurante = await restauranteModel.update(pool, id, dados);
  if (!restaurante) throw AppError.notFound('Restaurante não encontrado.');
  return restaurante;
}

module.exports = { listar, criar, atualizar };
