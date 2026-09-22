const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/env');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

if (config.trustProxy) app.set('trust proxy', config.trustProxy === 'true' ? 1 : config.trustProxy);

// upgrade-insecure-requests desligado: quebraria o Swagger UI quando a API é servida via HTTP (dev/rede interna)
app.use(
  helmet({
    contentSecurityPolicy: { useDefaults: true, directives: { 'upgrade-insecure-requests': null } },
  }),
);
app.use(
  cors({
    origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json({ limit: '100kb' }));

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
