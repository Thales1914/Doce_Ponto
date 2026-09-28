const { verifyToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

/** Exige JWT válido da administradora. */
function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const match = /^Bearer ([^\s]+)$/i.exec(header);
  if (!match) return next(AppError.unauthorized('Token de acesso ausente ou malformado.'));
  try {
    req.admin = verifyToken(match[1]);
  } catch {
    return next(AppError.unauthorized('Token inválido ou expirado.'));
  }
  next();
}

module.exports = { requireAdmin };
