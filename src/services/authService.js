const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const adminModel = require('../models/adminModel');
const { signToken } = require('../middlewares/auth');

// Hash descartável para gastar o mesmo tempo quando o e-mail não existe (evita enumeração por tempo de resposta)
const DUMMY_HASH = bcrypt.hashSync('senha-inexistente', 10);

async function login({ email, senha }) {
  const admin = await adminModel.findByEmail(pool, email);
  const ok = await bcrypt.compare(senha, admin ? admin.senha_hash : DUMMY_HASH);
  if (!admin || !ok) throw AppError.unauthorized('E-mail ou senha inválidos.');
  return {
    token: signToken(admin),
    tipo: 'Bearer',
    expira_em: config.jwt.expiresIn,
    admin: { id: admin.id, nome: admin.nome, email: admin.email },
  };
}

async function getProfile(id) {
  const admin = await adminModel.findById(pool, id);
  if (!admin) throw AppError.unauthorized('Usuária não encontrada.');
  return admin;
}

/** Cria a administradora inicial a partir do .env se ainda não houver nenhuma. */
async function ensureInitialAdmin() {
  const { nome, email, senha } = config.admin;
  if (!email || !senha) return;
  if (await adminModel.count(pool)) return;
  await adminModel.create(pool, { nome, email, senhaHash: await bcrypt.hash(senha, 10) });
  console.log(`Administradora inicial criada: ${email}`);
}

module.exports = { login, getProfile, ensureInitialAdmin };
