const rateLimit = require('express-rate-limit');
const config = require('../config/env');

function limiter({ windowMs, limit, mensagem }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => config.isTest,
    handler: (req, res) => {
      res.status(429).json({ erro: { codigo: 'MUITAS_REQUISICOES', mensagem } });
    },
  });
}

const MIN = 60 * 1000;

module.exports = {
  // força bruta no login
  loginLimiter: limiter({ windowMs: 15 * MIN, limit: 10, mensagem: 'Muitas tentativas de login. Tente novamente em alguns minutos.' }),
};
