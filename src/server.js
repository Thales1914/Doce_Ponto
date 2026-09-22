const config = require('./config/env');
const { pool } = require('./db/pool');
const { migrate } = require('./db/migrate');
const { ensureInitialAdmin } = require('./services/authService');
const app = require('./app');

async function main() {
  await migrate();
  await ensureInitialAdmin();

  const server = app.listen(config.port, () => {
    console.log(`API no ar na porta ${config.port} (${config.env})`);
  });

  const shutdown = () => {
    server.close(() => pool.end().then(() => process.exit(0)));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Falha ao iniciar a API:', err);
  process.exit(1);
});
