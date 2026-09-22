# DocePonto — Backend (API)

Backend do projeto **DocePonto**: API REST (Node.js + Express + PostgreSQL) para gestão de estoque, pedidos de clientes, vendas para restaurantes e financeiro. Somente backend; o frontend será desenvolvido separadamente.

> Esta branch contém as **Fases 4 a 6** (empilhada sobre `feature/backend-base-auth-estoque`): pedidos do cliente, gestão administrativa e acompanhamento público. Fecha o **marco do fluxo principal**.

## Como rodar

```bash
cp .env.example .env
docker compose up --build
docker compose exec api npm test
```

## Adicionado nesta branch
- Público: `POST /api/pedidos`, `GET /api/pedidos/:numero`, `POST /api/pedidos/:numero/observacoes`
- Administradora: `GET /api/pedidos`, `GET /api/pedidos/:id/detalhes`, `PUT /api/pedidos/:id/status`
- Confirmar pedido baixa o estoque; cancelar estorna. Toda mudança de status grava histórico.
