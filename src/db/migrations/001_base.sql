-- Administradora, clientes, produtos e movimentações de estoque

CREATE TABLE usuarios_admin (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  senha_hash  VARCHAR(255) NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX usuarios_admin_email_key ON usuarios_admin (lower(email));

CREATE TABLE clientes (
  id         SERIAL PRIMARY KEY,
  nome       VARCHAR(120) NOT NULL,
  contato    VARCHAR(120) NOT NULL,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Identificação simples: o contato identifica o cliente
CREATE UNIQUE INDEX clientes_contato_key ON clientes (lower(contato));

CREATE TABLE produtos (
  id                     SERIAL PRIMARY KEY,
  nome                   VARCHAR(120) NOT NULL,
  descricao              TEXT,
  preco                  NUMERIC(10,2) NOT NULL CHECK (preco >= 0),
  quantidade_disponivel  INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_disponivel >= 0),
  ativo                  BOOLEAN NOT NULL DEFAULT true,
  criado_em              TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE estoque_movimentacoes (
  id               SERIAL PRIMARY KEY,
  produto_id       INTEGER NOT NULL REFERENCES produtos(id),
  tipo             VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste')),
  -- entrada/saida: unidades movimentadas; ajuste: novo saldo contado
  quantidade       INTEGER NOT NULL CHECK (quantidade >= 0),
  saldo_anterior   INTEGER NOT NULL,
  saldo_posterior  INTEGER NOT NULL,
  motivo           VARCHAR(255),
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX estoque_movimentacoes_produto_idx ON estoque_movimentacoes (produto_id, criado_em DESC);
