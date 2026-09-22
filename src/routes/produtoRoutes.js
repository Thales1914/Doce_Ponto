const router = require('express').Router();
const validate = require('../middlewares/validate');
const { requireAdmin, optionalAdmin } = require('../middlewares/auth');
const { idParam } = require('../validators/common');
const schemas = require('../validators/produtoSchemas');
const controller = require('../controllers/produtoController');

// Catálogo: público (só ativos, sem saldo); com token da admin retorna tudo
router.get('/', optionalAdmin, validate({ query: schemas.listar }), controller.listar);

router.get('/:id', requireAdmin, validate({ params: idParam }), controller.obter);
router.post('/', requireAdmin, validate({ body: schemas.criar }), controller.criar);
router.put('/:id', requireAdmin, validate({ params: idParam, body: schemas.atualizar }), controller.atualizar);
router.delete('/:id', requireAdmin, validate({ params: idParam }), controller.remover);

module.exports = router;
