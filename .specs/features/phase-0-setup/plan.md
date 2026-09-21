# Fase 0 — Setup e fundações

## Problem

Hoje o monorepo é o scaffold dos templates e ainda não aguenta o primeiro módulo de negócio. A API
sobe na porta 3000, a mesma do web, a menos que `PORT` esteja definida. Ela responde erros no
formato padrão do Nest (`{ statusCode, message, error }`, e `message` às vezes é um array), que
contradiz a regra do `AGENTS.md`. Não há validação de entrada instalada. O schema é criado por
`synchronize` fora de produção, então uma mudança de entidade pode apagar colunas sem aviso. O
único e2e aponta para o banco de desenvolvimento e espera um "Hello World". O web ainda é a página
do template do Next. O repositório não tem CI, e nada de lint, teste ou build roda sozinho.

Quem paga é cada fase seguinte (1 a 29): cada uma teria que inventar o próprio formato de erro, a
própria validação e o próprio jeito de mexer no schema, e a primeira que copiar um padrão errado vira
o precedente. A fonte (ROADMAP, Fase 0) não traz números além disso.

Quando isto estiver pronto, um módulo novo nasce numa convenção de pastas conhecida. Toda entrada
passa por validação, todo erro sai como `{ "error": "..." }`, o schema só muda por migration, os e2e
rodam num banco separado, a CI barra regressões e a home do web mostra se a API está no ar.

## Flow

Reaproveita o `ConfigModule`, o `TypeOrmModule.forRootAsync` e o CORS por `FRONTEND_URL` que já
existem. Nada disso é reescrito, só reconfigurado.

1. navegador abre `/` -> `RootLayout` (exists, reescrito) - cabeçalho, navegação lateral vazia, área de conteúdo
2. home (exists, reescrita) - mostra "Verificando a API…" e chama o cliente HTTP (door 8)
3. cliente HTTP (door 8) - monta `${NEXT_PUBLIC_API_URL}/health` e faz o `fetch` no navegador
4. `NestFactory` bootstrap (exists) - CORS, `ValidationPipe` global (door 4), filtro global de exceções (door 1), porta padrão 3001
5. `GET /health` -> módulo `health` (new, no door - placement per door 5) - `SELECT 1` no `DataSource` (exists) com timeout de 3000 ms
6. out: `200 { "status": "ok" }` ou `503 { "error": "Database unavailable" }` (door 2). O cliente converte `{ error }` em `ApiError` e a home mostra "API ok" ou "API indisponível"

Caminhos paralelos, sem request do usuário:

- `npm --prefix api run migration:run` -> `nest build` -> CLI do TypeORM sobre `dist/database/data-source.js` (door 3) -> tabela `migrations`
- `npm --prefix api run test:e2e` -> globalSetup (door 7) cria `forge_test` se faltar e aplica as migrations -> suíte e2e com a app configurada como no `main.ts`
- push/PR em `main` -> workflow do GitHub Actions (door 9) -> lint/test/build de `api/` e `web/`, e `test:e2e` com um serviço Postgres 17

## Impact

| Front | What changes |
| --- | --- |
| route | `GET /` "Hello World" deixa de existir e passa a responder 404. Só `app.controller.spec.ts` e `app.e2e-spec.ts` dependem dela, e os dois são substituídos |
| config | a porta padrão da API muda de 3000 para 3001. O `docker-compose.yml` já define `PORT=3001`, então isso só afeta quem roda `start:dev` sem `PORT` |
| contract | todo erro da API muda de `{ statusCode, message, error }` para `{ "error": string }`. Ainda não existe nenhum consumidor além do web desta mesma mudança |
| stored data | `synchronize` é desligado. Não existe nenhuma entidade, então nenhum volume `pgdata` tem tabelas de negócio e não há nada para migrar |
| dependencies | api ganha `class-validator` e `class-transformer`. web ganha `vitest` 4.x (a 5.x conflita com `@types/node@20` do web), `@testing-library/react`, `jsdom` e `vite-tsconfig-paths` (door 6). As imagens `dev` do Docker precisam de rebuild |
| web | a página do template e os metadados "Create Next App" são substituídos. O `lang` passa de `en` para `pt-BR` |
| docs | `AGENTS.md` ganha a convenção de pastas por módulo (door 5) |
| infra | `docker-compose.yml` ganha healthcheck em `api` (`/health`) e `web`, para `docker compose up --wait` só voltar com os dois respondendo. Um volume anônimo `node_modules` antigo precisa de `up -V` uma vez para ver as dependências novas |

## Relations

`None - no stored-data shape change`. A Fase 0 não cria entidades. Só a tabela `migrations` do
TypeORM aparece, e ela é da ferramenta.

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /health` | nada | `{ "status": "ok" }` · `{ "error": string }` | `200`, `503` |
| qualquer rota inexistente, incluindo `GET /` | qualquer coisa | `{ "error": string }` | `404` |
| qualquer rota com corpo inválido | corpo JSON malformado, tipos errados ou propriedades não declaradas no DTO | `{ "error": string }` | `400` |
| qualquer rota com falha inesperada | qualquer coisa | `{ "error": "Internal server error" }` | `500` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. contrato de erro da API | corpo com uma única chave, `{ "error": string }`, com o status HTTP da exceção. `500` sempre responde `"Internal server error"` | o formato padrão do Nest, `{ statusCode, message, error }`: `message` pode ser string ou array, o que obrigaria todo consumidor a tratar dois formatos. Além disso, o `AGENTS.md` exige `{ error }` |
| 2. forma do health check | `GET /health` -> `200 { "status": "ok" }` / `503 { "error": "Database unavailable" }` | `@nestjs/terminus`: é mais uma dependência, e o formato dele (`{ status, info, error, details }`) quebra o contrato da door 1 |
| 3. schema só por migrations | `synchronize: false` em todo ambiente. Data source em `api/src/database/data-source.ts`, migrations em `api/src/database/migrations/`, e o CLI roda sobre `dist/database/data-source.js` depois do `nest build`. Scripts: `migration:generate`, `migration:run`, `migration:revert`. Tabela `migrations` | rodar o `.ts` com loader (`ts-node`/`tsx`): nenhum dos dois está instalado, a API é ESM (`"type": "module"`), e o type stripping do Node 24 não aceita os decorators das entidades |
| 4. biblioteca de validação | `class-validator` + `class-transformer`, com `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` global | pipes com zod: não é o padrão do Nest, e cada DTO teria o schema e o tipo duplicados |
| 5. convenção de pastas por módulo | `api/src/modules/<nome>/` com `<nome>.module.ts`, `<nome>.controller.ts`, `<nome>.service.ts`, `entities/<entidade>.entity.ts`, `dto/<ação>-<nome>.dto.ts`, e specs `*.spec.ts` ao lado do arquivo testado. Documentada no `AGENTS.md` | pastas por camada (`controllers/`, `services/`): espalham cada um dos 17 módulos do roadmap por várias pastas |
| 6. test runner no web | `vitest` + `@testing-library/react` + `jsdom`, com o script `npm --prefix web run test` | só o Playwright MCP: não devolve código de saída para a CI, e o estado de erro só aparece derrubando a API de verdade |
| 7. banco de teste | `forge_test`, nome vindo de `DB_NAME_TEST`, criado pelo globalSetup do e2e se não existir, com as migrations aplicadas antes da suíte | script de init do Docker: só roda com o volume `pgdata` vazio (quem já tem volume não ganha o banco), e o serviço Postgres da CI não executa esse script |
| 8. cliente HTTP do web | um único módulo, `web/src/lib/api.ts`, que exporta `apiFetch<T>(path, init?)` e `ApiError { status, message }`, com `status 0` para falha de rede | `fetch` direto em cada página: cada tela voltaria a decodificar `{ error }` do seu jeito |
| 9. CI | `.github/workflows/ci.yml`, disparado em push e pull request para `main`, com um job `api` (serviço `postgres:17`) e um job `web`, ambos em Node 24 | um job único: a falha de um lado esconde o resultado do outro |

- Nothing else in this change is hard to reverse

## Criteria

### S1: A API recusa entrada inválida e responde erros num formato só (P1)

Qualquer erro da API chega ao cliente como `{ "error": "..." }`, com o status certo e sem stack.

**Acceptance Criteria**

1. The API SHALL respond to every request that ends in an error status (4xx or 5xx) with a JSON body whose only key is `error`, holding a non-empty string
2. WHEN a request targets a route that does not exist THEN the API SHALL respond `404` with `{ "error": "Cannot <METHOD> <path>" }`
3. IF a request body is malformed JSON THEN the API SHALL respond `400` with `{ error }`
4. IF a request body violates a DTO constraint (wrong type or missing required field) THEN the API SHALL respond `400` with `error` holding every violated constraint message joined by `"; "`
5. IF a request body contains a property the DTO does not declare THEN the API SHALL respond `400` with `error` containing `property <name> should not exist`
6. WHEN a DTO declares a numeric field and the request carries it as the string `"5"` THEN the handler SHALL receive the number `5` inside an instance of the DTO class
7. IF a handler throws something that is not an `HttpException` THEN the API SHALL respond `500` with `{ "error": "Internal server error" }`, with neither the original message nor the stack in the body
8. WHEN a handler throws something that is not an `HttpException` THEN the API SHALL log the error's stack through the Nest `Logger`

**Independent test:** `curl -X POST localhost:3001/nada -d '{x'` devolve 400 `{ error }`, e `curl localhost:3001/nada` devolve 404 `{ error }`.

### S2: Health check com o banco (P1)

O `/health` responde se a API está no ar e se consegue falar com o Postgres.

**Acceptance Criteria**

9. WHILE the database answers `SELECT 1` WHEN `GET /health` is requested THEN the API SHALL respond `200` with `{ "status": "ok" }`
10. IF the database query fails during `GET /health` THEN the API SHALL respond `503` with `{ "error": "Database unavailable" }`
11. IF the database query does not answer within 3000 ms during `GET /health` THEN the API SHALL respond `503` with `{ "error": "Database unavailable" }`
12. WHEN `GET /` is requested THEN the API SHALL respond `404` with `{ error }`
13. WHERE `PORT` is not set the API SHALL listen on port `3001`

**Independent test:** com o `docker compose up`, `curl localhost:3001/health` devolve 200. Depois de `docker compose stop db`, devolve 503.

### S3: Schema só por migrations (P1)

O schema do banco só muda por migration versionada.

**Acceptance Criteria**

14. The API SHALL configure TypeORM with `synchronize: false` for every value of `NODE_ENV`
15. WHEN `npm --prefix api run migration:run` runs against an empty database THEN the command SHALL exit `0` and the table `migrations` SHALL exist

**Independent test:** apague o banco, rode `migration:run` e confira `\dt` no `psql`.

### S4: E2E contra um banco de teste (P1)

A suíte e2e roda isolada do banco de desenvolvimento.

**Acceptance Criteria**

16. WHEN `npm --prefix api run test:e2e` runs and the database `forge_test` does not exist THEN the suite SHALL create it and apply every migration before the first test
17. WHILE `test:e2e` runs the app under test SHALL connect to the database named by `DB_NAME_TEST` (default `forge_test`) and never to the one named by `DB_NAME`

**Independent test:** `DROP DATABASE forge_test`, rode `test:e2e` e veja a suíte passar com o banco recriado.

### S5: Casca do web e status da API (P1)

A home do web mostra, dentro do layout base, se a API responde.

**Acceptance Criteria**

18. The web SHALL render on every page a header with the text `Brios3D Forge`, an empty side navigation and a content area
19. WHILE the `/health` request is pending the home SHALL show `Verificando a API…`
20. WHEN `/health` answers `200` THEN the home SHALL show `API ok`
21. IF `/health` answers with an error body `{ error }` THEN the home SHALL show `API indisponível` and the `error` text
22. IF the API cannot be reached (network failure) THEN the home SHALL show `API indisponível` and `Não foi possível conectar à API`
23. The HTTP client SHALL build every request URL by prefixing the path with `NEXT_PUBLIC_API_URL`
24. IF `NEXT_PUBLIC_API_URL` is empty THEN the HTTP client SHALL throw `ApiError` with the message `NEXT_PUBLIC_API_URL não configurada` without calling `fetch`
25. IF an error response body is not in the `{ error: string }` format THEN the HTTP client SHALL throw `ApiError` with the response status and the message `Erro <status> da API`

**Independent test:** `npm --prefix web run dev` com a API no ar mostra "API ok". Parando a API e recarregando, a home mostra "API indisponível".

### S6: Ambiente e CI (P2)

Um clone novo sobe com um comando, e todo push passa pelos mesmos portões.

**Acceptance Criteria**

26. The `.env.example` SHALL declare `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_NAME_TEST`, `PORT`, `FRONTEND_URL` and `NEXT_PUBLIC_API_URL`
27. The `.gitignore` SHALL ignore `*.tsbuildinfo` files in any folder
28. WHEN a push or pull request targets `main` THEN the CI workflow SHALL run `lint`, `test`, `build` and `test:e2e` for `api/` against a Postgres 17 service, and `lint`, `test` and `build` for `web/`, and SHALL fail if any of them fails
29. WHEN `docker compose up` runs with a `.env` copied from `.env.example` THEN the services `db`, `api` (port 3001) and `web` (port 3000) SHALL start and `GET http://localhost:3001/health` SHALL answer `200`

**Independent test:** `cp .env.example .env && docker compose up --build`, depois abra `http://localhost:3000`.

## Out of scope

| Excluded | Why |
| --- | --- |
| Proteger o `/health` com autenticação | a autenticação chega na Fase 3, e o `/health` fica público lá (`@Public()`) |
| Itens na navegação lateral | cada fase acrescenta os seus. Aqui só existe a casca |
| Atualização automática do status na home (polling) | um status lido ao carregar a página basta para o objetivo da fase |
| Deploy e imagem de produção na CI | o roadmap não pede CD. A CI só valida |
| Métricas e tracing de requisições | nenhuma fase do MVP pede isso. O log de erro inesperado (AC 8) é o mínimo |
| Subir a API com o banco fora do ar | o `TypeOrmModule` tenta reconectar e desiste no boot, e esse comportamento fica como está. O AC 10 cobre o banco caindo depois do boot |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Test runner no web (door 6) | Vitest + Testing Library + jsdom, com proof por código de saída para os ACs 18–25 | o `AGENTS.md` pede teste ao mudar comportamento, e sem runner os ACs do web só teriam proof manual | y |
| Onde a home busca o `/health` | client component, `fetch` no navegador | o estado de carregamento (AC 19) só existe no cliente, e dentro do Docker `localhost:3001` visto do servidor do Next aponta para o próprio container do web | y |
| Idioma dos textos da interface | pt-BR, com `<html lang="pt-BR">` | o negócio e o `CONTEXT.md` estão em português. O código e as mensagens de erro da API ficam em inglês | y |
| Onde documentar a convenção de módulos | uma seção curta no `AGENTS.md` da raiz | é o que os agentes leem antes de mexer no código. O `api/README.md` é o do template | y |
| `migration:generate` e `migration:revert` sem migration real | os scripts entram agora, e o primeiro uso real acontece na Fase 3 (`User`) | sem entidade não há diff para gerar nem migration para reverter. Um teste agora exigiria uma entidade de fixture | y |
| Mensagem de erro da API | em inglês (`Database unavailable`, `Internal server error`), repassando o texto do `class-validator` | o `AGENTS.md` pede código em inglês, e o web mostra o texto recebido sem traduzir | y |

**Open questions:**

| # | Kind | Question | Until answered |
| --- | --- | --- | --- |
| 1 | blocks go-live | Posso fazer o primeiro push para `origin` (`github.com/mattbrios/brios3d_forge`)? A branch `main` ainda não tem nenhum commit | o AC 28 só é provado de verdade por uma execução no GitHub. Até lá, a proof local roda os mesmos comandos do workflow |

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen home | loading state | AC 19 |
| screen home | error state | AC 21, AC 22 |
| screen home | empty state | n/a - mostra um único status, não uma lista |
| screen home | unauthorised state | n/a - não existe autenticação até a Fase 3 |
| screen home | destructive action confirms | n/a - a tela não tem ações |
| layout | density and ordering | AC 18 |
| API `GET /health` | response shape | AC 9 |
| API `GET /health` | error shape and codes | AC 10, AC 11 |
| API `GET /health` | who may call it | n/a - público até a Fase 3, que o marca como `@Public()` |
| all API routes | error shape and codes | AC 1–5, AC 7 |
| all API routes | versioning, rate limits | n/a - só o web desta mesma mudança consome a API. Não há cliente externo para versionar nem limitar |
| command `migration:run` | exit codes and output | AC 15 |
| command `migration:run` | fails halfway | existing - o TypeORM roda as migrations dentro de transação por padrão (`--transaction default`) |
| command `test:e2e` | exit codes | AC 16, AC 17 |
| CI workflow | output and exit codes | AC 28 |
| doc `.env.example` | structure and what the reader does next | AC 26, AC 29 (`cp .env.example .env`) |

## Sources

- `ROADMAP.md` Fase 0 - tarefas e critérios de aceite
- `AGENTS.md` - formato de erro, validação, `NEXT_PUBLIC_API_URL`, `.env.example`, regra de teste
