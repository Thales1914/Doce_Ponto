const { z, id, money, dateStr, pagination, optionalText } = require('./common');

const forma = z.string().trim().min(1).max(30);

const restauranteCriar = z.object({
  nome: z.string().trim().min(2).max(120),
  contato: optionalText(120),
});

const restauranteAtualizar = z
  .object({ nome: z.string().trim().min(2).max(120), contato: optionalText(120) })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Informe ao menos um campo para atualizar.');

const restauranteListar = z.object({ busca: z.string().trim().max(120).optional() });

const vendaCriar = z.object({
  restaurante_id: id,
  produto_id: id,
  quantidade: z.number().int().min(1).max(100_000),
  valor_total: money({ allowZero: true }).optional(),
});

const vendaListar = z.object({
  restaurante_id: id.optional(),
  status_pagamento: z.enum(['pendente', 'recebido']).optional(),
  inicio: dateStr.optional(),
  fim: dateStr.optional(),
  ...pagination,
});

const pagamento = z.object({
  status_pagamento: z.enum(['pendente', 'recebido']),
  forma: forma.optional(),
  data: dateStr.optional(),
});

const entradaStatus = z.object({
  status: z.enum(['pendente', 'recebido']),
  forma: forma.optional(),
  data: dateStr.optional(),
});

const entradaCriar = z.object({
  descricao: z.string().trim().min(1).max(255),
  valor: money(),
  forma: forma.optional(),
  status: z.enum(['pendente', 'recebido']).default('recebido'),
  data: dateStr.optional(),
});

const entradaListar = z.object({
  status: z.enum(['pendente', 'recebido', 'cancelado']).optional(),
  origem: z.enum(['pedido', 'venda_restaurante', 'manual']).optional(),
  inicio: dateStr.optional(),
  fim: dateStr.optional(),
  ...pagination,
});

const saidaCriar = z.object({
  descricao: z.string().trim().min(1).max(255),
  categoria: optionalText(60),
  valor: money(),
  data: dateStr.optional(),
});

const saidaListar = z.object({
  categoria: z.string().trim().min(1).max(60).optional(),
  inicio: dateStr.optional(),
  fim: dateStr.optional(),
  ...pagination,
});

module.exports = {
  restauranteCriar, restauranteAtualizar, restauranteListar, vendaCriar, vendaListar, pagamento,
  entradaStatus, entradaCriar, entradaListar, saidaCriar, saidaListar,
};
