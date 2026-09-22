# DocePonto — Backend (API)

Backend do projeto **DocePonto**: API REST (Node.js + Express + PostgreSQL) para gestão de estoque, pedidos de clientes, vendas para restaurantes e financeiro. Somente backend; o frontend será desenvolvido separadamente.

> Esta branch contém as **Fases 1 a 3** do plano: arquitetura e Docker, autenticação (JWT) e produtos/estoque.
> Ordem das branches: `feature/backend-base-auth-estoque` → `feature/backend-pedidos` → `feature/backend-vendas-financeiro-dashboard`.

## Como rodar

```bash
cp .env.example .env        # ajuste JWT_SECRET, ADMIN_EMAIL e ADMIN_SENHA
docker compose up --build   # sobe PostgreSQL + API (migrations aplicadas no boot)
docker compose exec api npm test
```

## Já disponível nesta branch
- `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST/PUT/DELETE /api/produtos`
- `POST /api/estoque/movimentacao`, `GET /api/estoque/movimentacoes`
- Banco completo (12 tabelas) criado por migrations versionadas em `src/db/migrations`
