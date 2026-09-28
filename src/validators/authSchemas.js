const { z } = require('zod');

const senha = z.string().min(1, 'Senha obrigatória.')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Senha deve ter no máximo 72 bytes.');

const login = z.object({
  email: z.string().trim().email('E-mail inválido.').max(255),
  senha,
});

const initialAdmin = z.object({
  nome: z.string().trim().min(1).max(120),
  email: login.shape.email.transform((value) => value.toLowerCase()),
  senha: senha.refine((value) => value.length >= 8, 'Senha deve ter pelo menos 8 caracteres.'),
});

module.exports = { login, initialAdmin };
