const router = require('express').Router();
const validate = require('../middlewares/validate');
const { requireAdmin } = require('../middlewares/auth');
const { loginLimiter } = require('../middlewares/rateLimit');
const schemas = require('../validators/authSchemas');
const controller = require('../controllers/authController');

router.post('/login', loginLimiter, validate({ body: schemas.login }), controller.login);
router.get('/me', requireAdmin, controller.me);

module.exports = router;
