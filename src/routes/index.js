const router = require('express').Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.use('/docs', require('./docsRoutes'));
router.use('/auth', require('./authRoutes'));
router.use('/produtos', require('./produtoRoutes'));
router.use('/estoque', require('./estoqueRoutes'));
router.use('/pedidos', require('./pedidoRoutes'));
router.use('/restaurantes', require('./restauranteRoutes'));
router.use('/vendas-restaurantes', require('./vendaRestauranteRoutes'));
router.use('/financeiro', require('./financeiroRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));

module.exports = router;
