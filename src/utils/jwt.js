const jwt = require('jsonwebtoken');
const config = require('../config/env');

function signToken(admin) {
  return jwt.sign({ email: admin.email }, config.jwt.secret, {
    algorithm: 'HS256',
    subject: String(admin.id),
    expiresIn: config.jwt.expiresIn,
  });
}

function verifyToken(token) {
  const payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
  if (!/^[1-9]\d*$/.test(payload.sub) || !Number.isSafeInteger(Number(payload.sub)) ||
      Number(payload.sub) > 2147483647 || !Number.isFinite(payload.exp)) {
    throw new Error('Token sem identificador ou expiração válidos.');
  }
  return { id: Number(payload.sub), email: payload.email };
}

module.exports = { signToken, verifyToken };
