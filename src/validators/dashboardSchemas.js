const { z, dateStr } = require('./common');

const resumo = z
  .object({ inicio: dateStr.optional(), fim: dateStr.optional() })
  .refine((v) => !v.inicio || !v.fim || v.inicio <= v.fim, {
    message: 'A data inicial deve ser anterior ou igual à final.',
    path: ['inicio'],
  });

module.exports = { resumo };
