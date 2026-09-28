-- Base da fase 2. A numeração não reutiliza as migrations da versão anterior.
-- Bancos existentes preservam seus dados; bancos novos recebem só autenticação.
CREATE TABLE IF NOT EXISTS usuarios_admin (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  senha_hash  VARCHAR(255) NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_admin_email_key
  ON usuarios_admin (lower(email));
