const bcrypt = require('bcryptjs');
const { pool, withTransaction } = require('../db/pool');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const adminModel = require('../models/adminModel');
const { signToken } = require('../utils/jwt');
const { initialAdmin } = require('../validators/authSchemas');

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
  await withTransaction(async (client) => {
    // Serializa o primeiro cadastro quando mais de uma instância inicia juntas.
    await client.query('SELECT pg_advisory_xact_lock($1)', [727002]);
    if (await adminModel.count(client)) return;

    const result = initialAdmin.safeParse(config.admin);
    if (!result.success) {
      throw new Error('Configure ADMIN_NOME, ADMIN_EMAIL e ADMIN_SENHA válidos para criar a administradora inicial (senha: mínimo 8 caracteres, máximo 72 bytes).');
    }
    const { nome, email, senha } = result.data;
    await adminModel.create(client, { nome, email, senhaHash: await bcrypt.hash(senha, 10) });
    console.log('Administradora inicial criada.');
  });
}

module.exports = { login, getProfile, ensureInitialAdmin };
