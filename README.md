# DocePonto — Backend (API)

Backend do projeto **DocePonto**. API REST (Node.js + Express + PostgreSQL) para gestão de estoque, pedidos de clientes, vendas para restaurantes e financeiro. Escopo somente de backend; o frontend será desenvolvido separadamente.

## Como rodar

```bash
cp .env.example .env        # ajuste JWT_SECRET, ADMIN_EMAIL e ADMIN_SENHA
docker compose up --build   # sobe PostgreSQL + API
```

- API: <http://localhost:3000/api> (porta configurável em `API_PORT`)
- Documentação interativa (Swagger UI): <http://localhost:3000/api/docs>
- Especificação OpenAPI (importável no Postman/Insomnia): `/api/docs/openapi.yaml` ou `/api/docs/openapi.json`
- No primeiro boot as migrations são aplicadas e a administradora inicial é criada com `ADMIN_EMAIL` / `ADMIN_SENHA` do `.env`.

### Testes

Testes de integração (API real + PostgreSQL). Usam um banco separado, `<POSTGRES_DB>_test`, criado automaticamente — os dados de desenvolvimento não são tocados.

```bash
docker compose exec api npm test      # com a stack no ar (rebuild após editar: docker compose up -d --build)
npm run test:local                    # fora do Docker (Node 22+, DB_HOST=localhost no .env)
```

## Fluxo principal

```
Cliente                                   Administradora
POST /api/pedidos  → numero_pedido        POST /api/auth/login → token
GET  /api/pedidos/:numero  (acompanha)    GET  /api/pedidos?status=solicitado
POST /api/pedidos/:numero/observacoes     PUT  /api/pedidos/:id/status  (confirmado → em_producao → pronto → entregue)
```

## Endpoints

| Método | Rota | Acesso |
|---|---|---|
| POST | `/api/auth/login` · GET `/api/auth/me` | público · admin |
| GET | `/api/produtos` | público (só ativos, sem saldo); com token: tudo |
| GET/POST/PUT/DELETE | `/api/produtos[/:id]` | admin |
| POST | `/api/estoque/movimentacao` · GET `/api/estoque/movimentacoes` | admin |
| POST | `/api/pedidos` | **público** |
| GET | `/api/pedidos/:numero` · POST `/api/pedidos/:numero/observacoes` | **público** |
| GET | `/api/pedidos` · GET `/api/pedidos/:id/detalhes` · PUT `/api/pedidos/:id/status` | admin |
| GET/POST/PUT | `/api/restaurantes[/:id]` | admin |
| GET/POST | `/api/vendas-restaurantes` · PUT `/api/vendas-restaurantes/:id/pagamento` | admin |
| GET/POST | `/api/financeiro/entradas` · PUT `/api/financeiro/entradas/:id/status` | admin |
| GET/POST | `/api/financeiro/saidas` | admin |
| GET | `/api/dashboard/resumo` | admin |

Detalhes de parâmetros e respostas: Swagger UI.

## Regras de negócio

- **Status do pedido**: `solicitado → confirmado → em_producao → pronto → entregue`; `cancelado` até antes de `entregue`. Etapas não podem ser puladas. Toda alteração grava histórico (quem, quando, nota interna).
- **Confirmar pedido**: baixa o estoque (movimentação de saída) e lança uma entrada **pendente** no financeiro; se faltar saldo, nada é alterado (409 `ESTOQUE_INSUFICIENTE`). O estoque não é exigido para *solicitar*.
- **Cancelar pedido confirmado**: estorna o estoque (movimentação de entrada) e cancela a entrada pendente. Entradas já recebidas não são apagadas.
- **Venda para restaurante**: a entrega é venda efetiva. Numa transação: registra a venda, baixa o estoque e lança entrada pendente. `PUT .../pagamento` sincroniza venda e financeiro.
- **Estoque**: `entrada` soma, `saida` subtrai (recusada se maior que o saldo), `ajuste` define o saldo (contagem física, exige motivo). O saldo do produto só muda por movimentação, então o histórico sempre fecha com o saldo.
- **Acompanhamento público** é pelo `numero_pedido` (ex.: `PED-7K3M9QXA`, aleatório e não sequencial, para não ser enumerável). A resposta não traz dados pessoais nem notas internas.

## Decisões de implementação (onde a especificação deixava em aberto)

- **Express 5 + `pg` puro + SQL em migrations `.sql` versionadas** (runner próprio, ~50 linhas, com lock) — sem ORM nem ferramenta de migração extra.
- **`zod`** para validação, **`bcryptjs`** (sem build nativo no Alpine), **`helmet`**, **`express-rate-limit`** (login e rotas públicas), testes com o **`node:test`** embutido (zero dependências de teste).
- **Camadas**: rotas → controllers → services → models. Services abrem as transações; models recebem o cliente/pool como 1º argumento para participar delas.
- **Exclusão de produto é lógica** (`ativo = false`): produtos são referenciados por pedidos, vendas e movimentações.
- **Cliente identificado pelo contato**: pedidos com o mesmo contato reutilizam o cadastro.
- **Preço congelado** em `itens_pedido.preco_unitario` no momento do pedido.
- **Catálogo público**: `GET /api/produtos` é público (o cliente precisa dos IDs para pedir); com token da administradora mostra também inativos e saldo.
- **Entrada financeira de pedido** (além da de restaurante, exigida) é criada na confirmação, para que "recebido/pendente" e o dashboard cubram os dois canais.
- **Datas** calculadas no fuso `APP_TIMEZONE` (padrão `America/Sao_Paulo`).
- **Colunas extras** além do DER sugerido: `estoque_movimentacoes.saldo_anterior/saldo_posterior/pedido_id/venda_restaurante_id`, `pedidos.estoque_baixado`, `financeiro_entradas.descricao/status` e as tabelas `pedido_status_historico` e `pedido_observacoes`.

## Limitações conhecidas (fora do escopo desta versão)

- Não há endpoint para cancelar/estornar uma venda a restaurante nem editar um pedido depois de criado.
- Uma venda a restaurante tem um único produto (conforme o DER); para vários produtos, registre várias vendas.
- Não há renovação/refresh de token: a sessão da administradora expira em `JWT_EXPIRES_IN`.
- Deploy: usar `JWT_SECRET` forte, `CORS_ORIGIN` com a origem do frontend, `TRUST_PROXY=true` atrás de proxy reverso (para o rate limit enxergar o IP real) e HTTPS no proxy.
