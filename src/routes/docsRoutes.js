const fs = require('node:fs');
const path = require('node:path');
const router = require('express').Router();
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');

const raw = fs.readFileSync(path.join(__dirname, '../docs/openapi.yaml'), 'utf8');
const spec = YAML.parse(raw);

// Especificação OpenAPI (importável no Postman/Insomnia) e interface Swagger UI
router.get('/openapi.json', (req, res) => res.json(spec));
router.get('/openapi.yaml', (req, res) => res.type('text/yaml').send(raw));
router.use('/', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'API Doces' }));

module.exports = router;
