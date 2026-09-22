-- Pedidos dos clientes, itens, histórico de status e observações adicionais

CREATE TABLE pedidos (
  id               SERIAL PRIMARY KEY,
  numero_pedido    VARCHAR(20) NOT NULL UNIQUE,
  cliente_id       INTEGER NOT NULL REFERENCES clientes(id),
  status           VARCHAR(20) NOT NULL DEFAULT 'solicitado'
                   CHECK (status IN ('solicitado', 'confirmado', 'em_producao', 'pronto', 'entregue', 'cancelado')),
  observacoes      TEXT,
  -- true enquanto o pedido tiver saída de estoque ativa (permite estornar no cancelamento)
  estoque_baixado  BOOLEAN NOT NULL DEFAULT false,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pedidos_status_idx ON pedidos (status);
CREATE INDEX pedidos_cliente_idx ON pedidos (cliente_id);
CREATE INDEX pedidos_criado_em_idx ON pedidos (criado_em);

CREATE TABLE itens_pedido (
  id              SERIAL PRIMARY KEY,
  pedido_id       INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id      INTEGER NOT NULL REFERENCES produtos(id),
  quantidade      INTEGER NOT NULL CHECK (quantidade > 0),
  -- preço congelado no momento do pedido
  preco_unitario  NUMERIC(10,2) NOT NULL CHECK (preco_unitario >= 0),
  UNIQUE (pedido_id, produto_id)
);

CREATE TABLE pedido_status_historico (
  id               SERIAL PRIMARY KEY,
  pedido_id        INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  status_anterior  VARCHAR(20),
  status_novo      VARCHAR(20) NOT NULL,
  admin_id         INTEGER REFERENCES usuarios_admin(id) ON DELETE SET NULL,
  observacao       TEXT,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pedido_status_historico_pedido_idx ON pedido_status_historico (pedido_id, id);

-- Observações adicionais enviadas pelo cliente após a criação do pedido
CREATE TABLE pedido_observacoes (
  id         SERIAL PRIMARY KEY,
  pedido_id  INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  texto      TEXT NOT NULL,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pedido_observacoes_pedido_idx ON pedido_observacoes (pedido_id, id);

ALTER TABLE estoque_movimentacoes
  ADD COLUMN pedido_id INTEGER REFERENCES pedidos(id) ON DELETE SET NULL;
