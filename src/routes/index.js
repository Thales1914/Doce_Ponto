const router = require('express').Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.use('/docs', require('./docsRoutes'));
router.use('/auth', require('./authRoutes'));

module.exports = router;
