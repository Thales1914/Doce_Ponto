const router = require('express').Router();
const validate = require('../middlewares/validate');
const { requireAdmin } = require('../middlewares/auth');
const { idParam } = require('../validators/common');
const schemas = require('../validators/financeiroSchemas');
const controller = require('../controllers/restauranteController');

router.use(requireAdmin);

router.get('/', validate({ query: schemas.restauranteListar }), controller.listar);
router.post('/', validate({ body: schemas.restauranteCriar }), controller.criar);
router.put('/:id', validate({ params: idParam, body: schemas.restauranteAtualizar }), controller.atualizar);

module.exports = router;
