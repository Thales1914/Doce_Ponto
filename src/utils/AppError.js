/** Erro de negócio/HTTP com resposta padronizada: { erro: { codigo, mensagem, detalhes? } } */
class AppError extends Error {
  constructor(status, codigo, mensagem, detalhes) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }

  static badRequest(mensagem, detalhes) {
    return new AppError(400, 'REQUISICAO_INVALIDA', mensagem, detalhes);
  }
  static unauthorized(mensagem = 'Não autenticado.') {
    return new AppError(401, 'NAO_AUTENTICADO', mensagem);
  }
  static conflict(mensagem, codigo = 'CONFLITO') {
    return new AppError(409, codigo, mensagem);
  }
}

module.exports = AppError;
