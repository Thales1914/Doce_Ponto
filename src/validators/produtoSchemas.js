const { z, id, money, pagination, boolQuery, dateStr, optionalText } = require('./common');

const criar = z.object({
  nome: z.string().trim().min(1).max(120),
  descricao: optionalText(2000),
  preco: money({ allowZero: true }),
  quantidade_disponivel: z.number().int().min(0).max(1_000_000).default(0),
  ativo: z.boolean().default(true),
});

// Saldo só muda por movimentação de estoque; .strict() devolve erro claro se vier no PUT
const atualizar = z
  .object({
    nome: z.string().trim().min(1).max(120),
    descricao: optionalText(2000),
    preco: money({ allowZero: true }),
    ativo: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Informe ao menos um campo para atualizar.');

const listar = z.object({
  ativo: boolQuery.optional(),
  busca: z.string().trim().max(120).optional(),
});

const movimentacao = z
  .object({
    produto_id: id,
    tipo: z.enum(['entrada', 'saida', 'ajuste']),
    quantidade: z.number().int().max(1_000_000),
    motivo: z.string().trim().max(255).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === 'ajuste') {
      if (v.quantidade < 0) ctx.addIssue({ code: 'custom', path: ['quantidade'], message: 'O saldo ajustado não pode ser negativo.' });
      if (!v.motivo) ctx.addIssue({ code: 'custom', path: ['motivo'], message: 'Informe o motivo do ajuste.' });
    } else if (v.quantidade < 1) {
      ctx.addIssue({ code: 'custom', path: ['quantidade'], message: 'A quantidade deve ser maior que zero.' });
    }
  });

const listarMovimentacoes = z.object({
  produto_id: id.optional(),
  tipo: z.enum(['entrada', 'saida', 'ajuste']).optional(),
  inicio: dateStr.optional(),
  fim: dateStr.optional(),
  ...pagination,
});

module.exports = { criar, atualizar, listar, movimentacao, listarMovimentacoes };
