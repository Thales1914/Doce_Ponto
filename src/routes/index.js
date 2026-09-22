const router = require('express').Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.use('/auth', require('./authRoutes'));
router.use('/produtos', require('./produtoRoutes'));
router.use('/estoque', require('./estoqueRoutes'));

module.exports = router;
