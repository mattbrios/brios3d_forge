# Fase 0 — Setup e fundações · checks

Profile: light
Plan: `.specs/features/phase-0-setup/plan.md`

## Intent

29 checks em 6 fatias · 9 one-way doors · 1 pergunta aberta, que bloqueia o go-live e não o build (C28, primeiro push)

Os comandos com `docker compose` supõem um `.env` copiado do `.env.example` e o serviço `db` no ar
(`docker compose up -d db`). Os testes e2e usam o banco `forge_test`, nunca o `forge`.

## Checks

### S1 - A API recusa entrada inválida e responde erros num formato só · 6 files · 8 KB · ~2k

**C1** - Toda resposta com status 400, 404 ou 500 tem um corpo JSON cuja única chave é `error`, com uma string não vazia (AC 1)
Proof: `npm --prefix api run test:e2e -- test/errors.e2e-spec.ts -t "every error status returns only the error key"`
Proof: `npm --prefix api run test -- src/common/filters/all-exceptions.filter.spec.ts -t "body has only the error key"`

**C2** - `GET /nada` responde `404` com `{ "error": "Cannot GET /nada" }` (AC 2)
Proof: `npm --prefix api run test:e2e -- test/errors.e2e-spec.ts -t "unknown route returns 404"`

**C3** - `POST` com o corpo `{x` e `Content-Type: application/json` responde `400` com `{ error }` (AC 3)
Proof: `npm --prefix api run test:e2e -- test/errors.e2e-spec.ts -t "malformed JSON returns 400"`

**C4** - Um corpo que viola duas constraints do DTO responde `400`, e `error` traz as duas mensagens do `class-validator` unidas por `"; "` (AC 4)
Proof: `npm --prefix api run test:e2e -- test/errors.e2e-spec.ts -t "validation errors are joined"`
Proof: `npm --prefix api run test -- src/common/filters/all-exceptions.filter.spec.ts -t "array message is joined"`

**C5** - Um corpo com a propriedade `extra`, que o DTO não declara, responde `400` com `error` contendo `property extra should not exist` (AC 5)
Proof: `npm --prefix api run test:e2e -- test/errors.e2e-spec.ts -t "undeclared property returns 400"`

**C6** - Uma query `?count=5`, declarada como número no DTO, chega ao handler como o número `5`, dentro de uma instância da classe do DTO (AC 6)
Proof: `npm --prefix api run test:e2e -- test/errors.e2e-spec.ts -t "numeric string is transformed"`

**C7** - Um `Error("segredo")` e uma string lançados pelo handler respondem `500` com exatamente `{ "error": "Internal server error" }`, sem `segredo` e sem stack no corpo (AC 7)
Proof: `npm --prefix api run test -- src/common/filters/all-exceptions.filter.spec.ts -t "non-http exception returns generic 500"`
Proof: `npm --prefix api run test:e2e -- test/errors.e2e-spec.ts -t "unexpected error returns 500"`

**C8** - Um `Error` lançado pelo handler é registrado com a stack por `Logger.error` (AC 8)
Proof: `npm --prefix api run test -- src/common/filters/all-exceptions.filter.spec.ts -t "logs the stack"`

### S2 - Health check com o banco · 5 files · 4 KB · ~1k

**C9** - Com o banco respondendo, `GET /health` devolve `200` com exatamente `{ "status": "ok" }` (AC 9)
Proof: `npm --prefix api run test:e2e -- test/health.e2e-spec.ts -t "returns 200 when the database answers"`
Proof: `npm --prefix api run test -- src/modules/health/health.service.spec.ts -t "ok when select 1 succeeds"`

**C10** - Quando o `SELECT 1` rejeita, `GET /health` devolve `503` com `{ "error": "Database unavailable" }` (AC 10)
Proof: `npm --prefix api run test -- src/modules/health/health.controller.spec.ts -t "503 when the query fails"`

**C11** - Uma query que ainda não respondeu aos 3000 ms gera `503` com `{ "error": "Database unavailable" }`, e uma que responde aos 2999 ms gera `200` (AC 11)
Proof: `npm --prefix api run test -- src/modules/health/health.controller.spec.ts -t "503 after 3000 ms"`

**C12** - `GET /` responde `404` com `{ error }`, e nenhuma resposta contém `Hello World` (AC 12)
Proof: `npm --prefix api run test:e2e -- test/health.e2e-spec.ts -t "root returns 404"`

**C13** - Sem `PORT`, a porta resolvida é `3001`; com `PORT=4000`, é `4000` (AC 13)
Proof: `npm --prefix api run test -- src/app.setup.spec.ts -t "resolves the port"`

### S3 - Schema só por migrations · 4 files · 3 KB · ~1k

**C14** - As opções do TypeORM da app e o data source do CLI têm `synchronize: false` para `NODE_ENV` `development`, `test` e `production` (AC 14)
Proof: `npm --prefix api run test -- src/database/typeorm-options.spec.ts -t "synchronize is always false"`

**C15** - `migration:run` num banco vazio sai com `0` e deixa criada a tabela `migrations` (AC 15)
Proof: `docker compose exec -T db psql -U forge -d forge -c "DROP DATABASE IF EXISTS forge_migrate_check" -c "CREATE DATABASE forge_migrate_check" && DB_NAME=forge_migrate_check npm --prefix api run migration:run && test "$(docker compose exec -T db psql -U forge -d forge_migrate_check -tAc "select to_regclass('public.migrations')")" = "migrations"`

### S4 - E2E contra um banco de teste · 3 files · 3 KB · ~1k

**C16** - Com `forge_test` apagado, `test:e2e` recria o banco, aplica as migrations e sai com `0` (AC 16)
Proof: `docker compose exec -T db psql -U forge -d forge -c "DROP DATABASE IF EXISTS forge_test" && npm --prefix api run test:e2e`
Proof: `npm --prefix api run test:e2e -- test/database.e2e-spec.ts -t "migrations table exists"`

**C17** - Durante o e2e, `select current_database()` na conexão da app devolve `forge_test`, e não o valor de `DB_NAME` (AC 17)
Proof: `DB_NAME=forge npm --prefix api run test:e2e -- test/database.e2e-spec.ts -t "connects to the test database"`

### S5 - Casca do web e status da API · 8 files · 6 KB · ~2k

**C18** - A casca renderiza um cabeçalho com `Brios3D Forge`, uma `nav` sem links e um `main` com os filhos (AC 18)
Proof: `npm --prefix web run test -- src/components/app-shell.test.tsx -t "renders header, empty nav and content"`

**C19** - Com o `/health` pendente, a home mostra `Verificando a API…` (AC 19)
Proof: `npm --prefix web run test -- src/components/health-status.test.tsx -t "shows loading"`

**C20** - Quando o `/health` responde `200`, a home mostra `API ok` (AC 20)
Proof: `npm --prefix web run test -- src/components/health-status.test.tsx -t "shows API ok"`

**C21** - Quando a resposta é `503 { "error": "Database unavailable" }`, a home mostra `API indisponível` e `Database unavailable`, e o cliente lança `ApiError` com `status 503` e essa mensagem (AC 21)
Proof: `npm --prefix web run test -- src/components/health-status.test.tsx -t "shows the api error"`
Proof: `npm --prefix web run test -- src/lib/api.test.ts -t "decodes the error body"`

**C22** - Quando o `fetch` rejeita, o cliente lança `ApiError` com `status 0`, e a home mostra `API indisponível` e `Não foi possível conectar à API` (AC 22)
Proof: `npm --prefix web run test -- src/lib/api.test.ts -t "network failure"`
Proof: `npm --prefix web run test -- src/components/health-status.test.tsx -t "shows the network error"`

**C23** - Com `NEXT_PUBLIC_API_URL=http://api.test:3001`, `apiFetch("/health")` chama `fetch` com `http://api.test:3001/health` (AC 23)
Proof: `npm --prefix web run test -- src/lib/api.test.ts -t "prefixes the base url"`

**C24** - Com `NEXT_PUBLIC_API_URL` vazia, `apiFetch` lança `ApiError("NEXT_PUBLIC_API_URL não configurada")` e `fetch` é chamado 0 vezes (AC 24)
Proof: `npm --prefix web run test -- src/lib/api.test.ts -t "missing base url"`

**C25** - Uma resposta `502` com corpo `<html>` faz o cliente lançar `ApiError` com `status 502` e a mensagem `Erro 502 da API` (AC 25)
Proof: `npm --prefix web run test -- src/lib/api.test.ts -t "non error body"`

### S6 - Ambiente e CI · 5 files · 5 KB · ~1k

**C26** - O `.env.example` declara as 9 variáveis `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_NAME_TEST`, `PORT`, `FRONTEND_URL` e `NEXT_PUBLIC_API_URL` (AC 26)
Proof: `for k in DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME DB_NAME_TEST PORT FRONTEND_URL NEXT_PUBLIC_API_URL; do grep -q "^$k=" .env.example || { echo "missing $k"; exit 1; }; done`

**C27** - O git ignora `api/tsconfig.build.tsbuildinfo` e `web/tsconfig.tsbuildinfo` (AC 27)
Proof: `git check-ignore -q api/tsconfig.build.tsbuildinfo && git check-ignore -q web/tsconfig.tsbuildinfo`

**C28** - O workflow `.github/workflows/ci.yml` é válido, dispara em `push` e `pull_request` para `main`, e roda nos jobs `api` e `web` cada comando listado no AC 28. Todos esses comandos passam localmente (AC 28)
Proof: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest -color .github/workflows/ci.yml`
Proof: `for c in "api run lint" "api run test" "api run build" "api run test:e2e" "web run lint" "web run test" "web run build"; do grep -q "npm --prefix ${c}\$" .github/workflows/ci.yml || { echo "missing: $c"; exit 1; }; done`
Proof: `npm --prefix api run lint && npm --prefix api run test && npm --prefix api run build && npm --prefix api run test:e2e && npm --prefix web run lint && npm --prefix web run test && npm --prefix web run build`

**C29** - `docker compose up` sobe `db`, `api` e `web`. A API rodando pelo `main.ts` responde `/health` 200, `/nada` 404 `{ error }` e JSON malformado 400 `{ error }` na porta 3001, e o web responde 200 na porta 3000 (AC 29, e AC 1–3 na assembly de produção)
Proof: `docker compose up -d --build --wait && npm --prefix api run smoke && curl -sf -o /dev/null http://localhost:3000`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /health` statuses (2) | 200 C9 · 503 C10, C11 | - |
| unknown route statuses (1) | 404 C2, C12 | - |
| invalid body causes, all 400 (3) | malformed JSON C3 · constraint violated C4 · undeclared property C5 | - |
| unexpected failure statuses (1) | 500 C7 | - |
| exception kinds the filter maps (4) | `HttpException` with string message C2 · `HttpException` with array message C4 · `Error` C7 · non-`Error` thrown value C7 | - |
| `ValidationPipe` options (3) | `whitelist` + `forbidNonWhitelisted` C5 · `transform` C6 · validation itself C4 | - |
| health DB outcomes (3) | answers C9 · rejects C10 · hangs past 3000 ms C11 | - |
| `NODE_ENV` values for `synchronize` (3) | `development` C14 · `test` C14 · `production` C14 | - |
| home states (4) | loading C19 · ok C20 · API error C21 · network error C22 | - |
| `apiFetch` outcomes (5) | success C20 · `{ error }` body C21 · non-`{ error }` body C25 · network failure C22 · missing base URL C24 | - |
| `.env.example` keys (9) | `DB_HOST` C26 · `DB_PORT` C26 · `DB_USER` C26 · `DB_PASSWORD` C26 · `DB_NAME` C26 · `DB_NAME_TEST` C26 · `PORT` C26 · `FRONTEND_URL` C26 · `NEXT_PUBLIC_API_URL` C26 | - |
| CI jobs (2) | `api` C28 · `web` C28 | - |
| startup config: filter + `ValidationPipe` + port (2 assemblies) | `main.ts` C29 (smoke) · e2e harness C1–C7, both via the shared `configureApp` | - |
| startup config: `synchronize: false` (2 places) | app `TypeOrmModule` options C14 · CLI data source C14 | - |
| one-way doors in `Landing` (9) | 1 C1 · 2 C9, C10 · 3 C14, C15 · 4 C4, C5, C6 · 5 C9 (`src/modules/health/`) · 6 C18–C25 · 7 C16, C17 · 8 C21–C25 · 9 C28 | - |

- Claims naming a status code, route or response shape: C1–C7, C9, C12, C29. Each one has a proof that crosses the HTTP boundary (e2e or smoke). C10 and C11 prove 503 at the controller, because derrubar o banco no meio do e2e mataria as outras suítes. O 503 também é conferido na mão com o `docker compose stop db`, no Playwright do fim
- C28 is proven locally only. The real GitHub run waits for open question 1 (push)
- No other check claims more than the single case its proof exercises

## Swept

- validation: C4, C5, C6
- failure modes: C7, C10
- idempotency: n/a - a Fase 0 não tem nenhuma escrita de negócio. O `GET /health` só lê, e a tabela `migrations` do TypeORM impede aplicar a mesma migration duas vezes
- authorization: n/a - não existe autenticação até a Fase 3. O `/health` continua público depois dela (`@Public()`)
- concurrency: n/a - nenhum estado compartilhado é escrito. As migrations rodam em transação (padrão do TypeORM) e só na mão ou no setup do e2e
- data lifecycle: n/a - nenhuma entidade. O `forge_test` é recriado pelo setup (C16), e não há retenção a definir
- dependency failure: C10, C11, C22
- state transitions: n/a - não há máquina de estado. Os três estados da home (C19–C22) são uma única transição, de pendente para resultado
- observability: C8

## Handoff

- S1–S6 ≈ 29 KB entre arquivos existentes (12 KB, `wc -c`) e novos (~17 KB estimados), ≈ 8k tokens, bem abaixo do budget de 150k. One builder

- **Boundary:** C1–C29 fechados no working tree, sem commit (o `AGENTS.md` proíbe commit sem pedido explícito)
- **Settled mid-build:** o usuário aceitou as recomendações do plano (Vitest no web, pt-BR, convenção no `AGENTS.md`); o push segue sem autorização
- **Abandoned:** `vitest@5` no web (conflito de peer com `@types/node@20`); `@testing-library/jest-dom` (desnecessário)
