const { z, id, pagination, dateStr, optionalText } = require('./common');
const { FORMATO_NUMERO_PEDIDO } = require('../utils/numeroPedido');

const STATUS = ['solicitado', 'confirmado', 'em_producao', 'pronto', 'entregue', 'cancelado'];

const criar = z.object({
  cliente: z.object({
    nome: z.string().trim().min(2).max(120),
    contato: z.string().trim().min(5, 'Informe um telefone ou e-mail válido.').max(120),
  }),
  itens: z
    .array(
      z.object({
        produto_id: id,
        quantidade: z.number().int().min(1).max(1000),
      }),
    )
    .min(1, 'O pedido precisa ter ao menos um item.')
    .max(50),
  observacoes: optionalText(1000),
});

// Aceita minúsculas e normaliza; formato inválido é rejeitado antes de tocar no banco
const numeroParam = z.object({
  numero: z
    .string()
    .trim()
    .toUpperCase()
    .regex(FORMATO_NUMERO_PEDIDO, 'Número de pedido inválido.'),
});

const adicionarObservacao = z.object({
  texto: z.string().trim().min(1, 'Informe a observação.').max(1000),
});

const listar = z.object({
  status: z.enum(STATUS).optional(),
  cliente_id: id.optional(),
  cliente: z.string().trim().min(1).max(120).optional(),
  inicio: dateStr.optional(),
  fim: dateStr.optional(),
  ...pagination,
});

const alterarStatus = z.object({
  status: z.enum(STATUS),
  observacao: optionalText(500),
});

module.exports = { STATUS, criar, numeroParam, adicionarObservacao, listar, alterarStatus };
