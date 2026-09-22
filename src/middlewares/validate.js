const AppError = require('../utils/AppError');

/**
 * Valida body/query/params com schemas zod. Os valores já convertidos ficam em `req.valid`
 * (req.query é somente leitura no Express 5).
 * Uso: validate({ body: schema, query: schema, params: schema })
 */
function validate(schemas) {
  return (req, res, next) => {
    const valid = {};
    const detalhes = [];
    for (const parte of ['params', 'query', 'body']) {
      if (!schemas[parte]) continue;
      const result = schemas[parte].safeParse(req[parte] ?? {});
      if (result.success) {
        valid[parte] = result.data;
      } else {
        for (const issue of result.error.issues) {
          detalhes.push({ local: parte, campo: issue.path.join('.'), mensagem: issue.message });
        }
      }
    }
    if (detalhes.length) return next(AppError.badRequest('Dados de entrada inválidos.', detalhes));
    req.valid = valid;
    next();
  };
}

module.exports = validate;
