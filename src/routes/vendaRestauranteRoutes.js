const router = require('express').Router();
const validate = require('../middlewares/validate');
const { requireAdmin } = require('../middlewares/auth');
const { idParam } = require('../validators/common');
const schemas = require('../validators/financeiroSchemas');
const controller = require('../controllers/vendaRestauranteController');

router.use(requireAdmin);

router.get('/', validate({ query: schemas.vendaListar }), controller.listar);
router.post('/', validate({ body: schemas.vendaCriar }), controller.registrar);
router.put('/:id/pagamento', validate({ params: idParam, body: schemas.pagamento }), controller.atualizarPagamento);

module.exports = router;
