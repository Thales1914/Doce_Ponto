const router = require('express').Router();
const validate = require('../middlewares/validate');
const { requireAdmin } = require('../middlewares/auth');
const schemas = require('../validators/produtoSchemas');
const controller = require('../controllers/estoqueController');

router.use(requireAdmin);

router.post('/movimentacao', validate({ body: schemas.movimentacao }), controller.registrar);
router.get('/movimentacoes', validate({ query: schemas.listarMovimentacoes }), controller.listar);

module.exports = router;
