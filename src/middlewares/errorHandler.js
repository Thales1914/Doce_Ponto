const AppError = require('../utils/AppError');

function notFoundHandler(req, res) {
  res.status(404).json({
    erro: { codigo: 'ROTA_NAO_ENCONTRADA', mensagem: `Rota ${req.method} ${req.path} não encontrada.` },
  });
}

// Traduz erros conhecidos de bibliotecas em AppError
function normalize(err) {
  if (err instanceof AppError) return err;
  if (err.type === 'entity.parse.failed') return AppError.badRequest('JSON inválido no corpo da requisição.');
  if (err.type === 'entity.too.large') return new AppError(413, 'CORPO_MUITO_GRANDE', 'Corpo da requisição muito grande.');
  switch (err.code) {
    case '23505':
      return AppError.conflict('Registro duplicado.', 'REGISTRO_DUPLICADO');
    case '23503':
      return AppError.conflict('Operação viola um relacionamento com outro registro.', 'VIOLACAO_RELACIONAMENTO');
    case '23514':
    case '22P02':
    case '22003':
      return AppError.badRequest('Valor inválido.');
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const known = normalize(err);
  if (known) {
    return res.status(known.status).json({
      erro: { codigo: known.codigo, mensagem: known.message, ...(known.detalhes && { detalhes: known.detalhes }) },
    });
  }
  console.error(`[erro] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor.' } });
}

module.exports = { notFoundHandler, errorHandler };
