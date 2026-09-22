-- Restaurantes, vendas para restaurantes e financeiro interno

CREATE TABLE restaurantes (
  id         SERIAL PRIMARY KEY,
  nome       VARCHAR(120) NOT NULL,
  contato    VARCHAR(120),
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vendas_restaurantes (
  id                 SERIAL PRIMARY KEY,
  restaurante_id     INTEGER NOT NULL REFERENCES restaurantes(id),
  produto_id         INTEGER NOT NULL REFERENCES produtos(id),
  quantidade         INTEGER NOT NULL CHECK (quantidade > 0),
  valor_total        NUMERIC(12,2) NOT NULL CHECK (valor_total >= 0),
  status_pagamento   VARCHAR(10) NOT NULL DEFAULT 'pendente'
                     CHECK (status_pagamento IN ('pendente', 'recebido')),
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX vendas_restaurantes_restaurante_idx ON vendas_restaurantes (restaurante_id);
CREATE INDEX vendas_restaurantes_criado_em_idx ON vendas_restaurantes (criado_em);

-- origem: pedido_id ou venda_restaurante_id (ambos nulos = receita lançada manualmente)
CREATE TABLE financeiro_entradas (
  id                    SERIAL PRIMARY KEY,
  pedido_id             INTEGER REFERENCES pedidos(id),
  venda_restaurante_id  INTEGER REFERENCES vendas_restaurantes(id),
  descricao             VARCHAR(255),
  valor                 NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
  forma                 VARCHAR(30),
  status                VARCHAR(10) NOT NULL DEFAULT 'pendente'
                        CHECK (status IN ('pendente', 'recebido', 'cancelado')),
  -- data do lançamento; ao marcar como recebido passa a ser a data do recebimento
  data                  DATE NOT NULL DEFAULT CURRENT_DATE,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (pedido_id IS NULL OR venda_restaurante_id IS NULL)
);
CREATE UNIQUE INDEX financeiro_entradas_pedido_key
  ON financeiro_entradas (pedido_id) WHERE pedido_id IS NOT NULL;
CREATE UNIQUE INDEX financeiro_entradas_venda_key
  ON financeiro_entradas (venda_restaurante_id) WHERE venda_restaurante_id IS NOT NULL;
CREATE INDEX financeiro_entradas_status_idx ON financeiro_entradas (status);
CREATE INDEX financeiro_entradas_data_idx ON financeiro_entradas (data);

CREATE TABLE financeiro_saidas (
  id         SERIAL PRIMARY KEY,
  descricao  VARCHAR(255) NOT NULL,
  categoria  VARCHAR(60),
  valor      NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  data       DATE NOT NULL DEFAULT CURRENT_DATE,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX financeiro_saidas_data_idx ON financeiro_saidas (data);

ALTER TABLE estoque_movimentacoes
  ADD COLUMN venda_restaurante_id INTEGER REFERENCES vendas_restaurantes(id) ON DELETE SET NULL;
