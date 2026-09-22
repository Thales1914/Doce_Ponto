const { z } = require('zod');

const login = z.object({
  email: z.string().trim().email('E-mail inválido.').max(255),
  senha: z.string().min(1, 'Senha obrigatória.').max(200),
});

module.exports = { login };
