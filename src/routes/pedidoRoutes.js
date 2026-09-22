const router = require('express').Router();
const validate = require('../middlewares/validate');
const { requireAdmin } = require('../middlewares/auth');
const { publicWriteLimiter, publicReadLimiter } = require('../middlewares/rateLimit');
const { idParam } = require('../validators/common');
const schemas = require('../validators/pedidoSchemas');
const controller = require('../controllers/pedidoController');

// Público: cliente cria o pedido sem login
router.post('/', publicWriteLimiter, validate({ body: schemas.criar }), controller.criar);

// Administradora
router.get('/', requireAdmin, validate({ query: schemas.listar }), controller.listar);
router.get('/:id/detalhes', requireAdmin, validate({ params: idParam }), controller.detalhar);
router.put('/:id/status', requireAdmin, validate({ params: idParam, body: schemas.alterarStatus }), controller.alterarStatus);

// Público: acompanhamento pelo número do pedido
router.get('/:numero', publicReadLimiter, validate({ params: schemas.numeroParam }), controller.acompanhar);
router.post(
  '/:numero/observacoes',
  publicWriteLimiter,
  validate({ params: schemas.numeroParam, body: schemas.adicionarObservacao }),
  controller.adicionarObservacao,
);

module.exports = router;
