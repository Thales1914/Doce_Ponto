const jwt = require('jsonwebtoken');
const config = require('../config/env');
const AppError = require('../utils/AppError');

function readToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme && scheme.toLowerCase() === 'bearer' && token ? token : null;
}

function verify(token) {
  const payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
  return { id: Number(payload.sub), email: payload.email };
}

/** Exige JWT válido da administradora. */
function requireAdmin(req, res, next) {
  const token = readToken(req);
  if (!token) return next(AppError.unauthorized('Token de acesso ausente.'));
  try {
    req.admin = verify(token);
    next();
  } catch {
    next(AppError.unauthorized('Token inválido ou expirado.'));
  }
}

/** Rotas públicas com visão ampliada para a admin: preenche req.admin se houver token válido. */
function optionalAdmin(req, res, next) {
  const token = readToken(req);
  if (token) {
    try {
      req.admin = verify(token);
    } catch {
      // token inválido: segue como visitante
    }
  }
  next();
}

function signToken(admin) {
  return jwt.sign({ email: admin.email }, config.jwt.secret, {
    algorithm: 'HS256',
    subject: String(admin.id),
    expiresIn: config.jwt.expiresIn,
  });
}

module.exports = { requireAdmin, optionalAdmin, signToken };
