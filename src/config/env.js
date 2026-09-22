const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return value;
};

const env = process.env.NODE_ENV || 'development';

const config = {
  env,
  isTest: env === 'test',
  port: Number(process.env.PORT) || 3000,
  timezone: process.env.APP_TIMEZONE || 'America/Sao_Paulo',
  corsOrigins: (process.env.CORS_ORIGIN || '*')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  trustProxy: process.env.TRUST_PROXY || false,
  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  admin: {
    nome: process.env.ADMIN_NOME || 'Administradora',
    email: process.env.ADMIN_EMAIL,
    senha: process.env.ADMIN_SENHA,
  },
  db: process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        user: required('POSTGRES_USER'),
        password: required('POSTGRES_PASSWORD'),
        database: required('POSTGRES_DB'),
      },
};

module.exports = config;
