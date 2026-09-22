const router = require('express').Router();
const validate = require('../middlewares/validate');
const { requireAdmin } = require('../middlewares/auth');
const schemas = require('../validators/dashboardSchemas');
const controller = require('../controllers/dashboardController');

router.get('/resumo', requireAdmin, validate({ query: schemas.resumo }), controller.resumo);

module.exports = router;
