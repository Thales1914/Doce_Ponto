const router = require('express').Router();
const validate = require('../middlewares/validate');
const { requireAdmin } = require('../middlewares/auth');
const { idParam } = require('../validators/common');
const schemas = require('../validators/financeiroSchemas');
const controller = require('../controllers/financeiroController');

router.use(requireAdmin);

router.get('/entradas', validate({ query: schemas.entradaListar }), controller.listarEntradas);
router.post('/entradas', validate({ body: schemas.entradaCriar }), controller.criarEntrada);
router.put('/entradas/:id/status', validate({ params: idParam, body: schemas.entradaStatus }), controller.atualizarStatusEntrada);

router.get('/saidas', validate({ query: schemas.saidaListar }), controller.listarSaidas);
router.post('/saidas', validate({ body: schemas.saidaCriar }), controller.criarSaida);

module.exports = router;
