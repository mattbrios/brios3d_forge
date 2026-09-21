# Fase 0 — Setup e fundações verification

**Verdict**: PASS
**Profile**: light
**Diff range**: working tree (no commits; repo unborn)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

29/29 checks proven at the current working tree, each with a located `file:line` assertion.
Four non-blocking gaps are listed under `## Gaps`. The largest is C28's go-live gap: the CI
workflow has not run on GitHub yet, which the ROADMAP acceptance criterion "A CI passa em um push"
still needs.

## Profile-scoped steps

- Step 1 (binding sources vs checks): not run. It only runs under `ui`. `ROADMAP.md` Fase 0 and
  `AGENTS.md` were read as inputs, and the residual items they raise are listed under `## Gaps`.
- Coverage recompute, Test policy verdicts, fault injection: not run (profile `light`).
  `checks.md` has no `Test policy` section.
- Swept rows: none resolves to `existing`. Every row cites a check (validation, failure modes,
  dependency failure, observability) or is `n/a` policy, so there is no cited constraint to
  re-read. The one `existing` in the plan (`Observable`: `migration:run` fails halfway, TypeORM
  default transaction) is not a Swept row. `package.json` runs `typeorm migration:run` with no
  `--transaction` flag, so the default applies.

## Proof runs (at the working tree)

| Invocation | Result |
| --- | --- |
| `docker compose exec -T db psql ... "DROP DATABASE IF EXISTS forge_test" && npm --prefix api run test:e2e -- --reporter=verbose` (C16 proof 1, which also covers every e2e-named proof) | exit 0. `forge_test` recreated, `migrations` table created, 11/11 passed, each named test listed with ✓ |
| `DB_NAME=forge npm --prefix api run test:e2e -- test/database.e2e-spec.ts -t "connects to the test database"` (C17, exact) | exit 0. 1 passed, 1 skipped (filter hit confirmed) |
| `npm --prefix api run test -- --reporter=verbose` (C1, C4, C7, C8, C9–C11, C13, C14 unit proofs) | exit 0, 10/10 passed, each named test listed |
| `npm --prefix web run test -- --reporter=verbose` (C18–C25) | exit 0, 10/10 passed, each named test listed |
| C15 command, exact | exit 0 |
| C26 command, exact | exit 0 |
| C27 command, exact, plus `git check-ignore -v foo/bar/x.tsbuildinfo` | exit 0 (and matched `.gitignore:6:*.tsbuildinfo`) |
| C28 actionlint (`rhysd/actionlint:latest`) | exit 0, no findings |
| C28 grep loop for the 7 commands | exit 0 |
| C28 chain `api lint && test && build && test:e2e && web lint && test && build` | exit 0 (api 10 + e2e 11 + web 10 tests, `next build` compiled) |
| C29 `docker compose up -d --build --wait && npm --prefix api run smoke && curl -sf -o /dev/null http://localhost:3000` | exit 0. db/api/web healthy. Smoke output: `ok GET /health -> 200 {"status":"ok"}`, `ok GET /nada -> 404 {"error":"Cannot GET /nada"}`, `ok POST /health with malformed JSON -> 400 {"error":"Expected property name ..."}` |
| Extra (not a check proof): `docker compose pause db`, then `curl /health`, then `unpause` | `{"error":"Database unavailable"} HTTP 503 in 3.0026s`, then `200 {"status":"ok"}` after unpause. db health came back to `healthy` |

Each `-t` filter named in `checks.md` matched exactly one listed test. `"503 after 3000 ms"`
matches by substring `503 after 3000 ms without an answer, 200 when it answers at 2999 ms`. No
name is missing from the tree. Every proof resolves to a file this feature created, and the
template's `app.controller*`, `app.service.ts` and `test/app.e2e-spec.ts` are gone.

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | 400/404/500 bodies have only `error`, a non-empty string | e2e `every error status returns only the error key` ✓. Unit `body has only the error key` ✓ | `api/test/errors.e2e-spec.ts:81` `toEqual([404, 400, 400, 500])`. `api/test/errors.e2e-spec.ts:84` `expect(Object.keys(response.body)).toEqual(['error'])`, `:86-87` string and length > 0. `api/src/common/filters/all-exceptions.filter.spec.ts:51` same across 5 exception kinds | PASS |
| C2 | `GET /nada` gives 404 `{ error: "Cannot GET /nada" }` | e2e `unknown route returns 404` ✓ | `api/test/errors.e2e-spec.ts:93-94` `toBe(404)`, `toEqual({ error: 'Cannot GET /nada' })` | PASS |
| C3 | malformed JSON `{x` gives 400 `{ error }` | e2e `malformed JSON returns 400` ✓ | `api/test/errors.e2e-spec.ts:102-103` `toBe(400)`, `keys toEqual(['error'])`. Non-empty string: `:86-87` over the same request | PASS |
| C4 | two violated constraints give 400 and the messages joined by `"; "` | e2e `validation errors are joined` ✓. Unit `array message is joined` ✓ | `api/test/errors.e2e-spec.ts:108-112` `toBe(400)`, `error.split('; ')` contains `name must be a string` and `qty must be an integer number`. `api/src/common/filters/all-exceptions.filter.spec.ts:72-74` `toEqual({ error: 'name must be a string; qty must be an integer number' })` | PASS |
| C5 | undeclared `extra` gives 400 with `property extra should not exist` | e2e `undeclared property returns 400` ✓ | `api/test/errors.e2e-spec.ts:119-121` `toBe(400)`, `toContain('property extra should not exist')` | PASS |
| C6 | `?count=5` reaches the handler as number 5, as a DTO instance | e2e `numeric string is transformed` ✓ | `api/test/errors.e2e-spec.ts:128` `toEqual({ value: 5, type: 'number', isInstance: true })` | PASS |
| C7 | `Error("segredo")` and a thrown string give 500 with exactly `{ error: "Internal server error" }`, and no secret or stack | unit `non-http exception returns generic 500` ✓. e2e `unexpected error returns 500` ✓ | `api/src/common/filters/all-exceptions.filter.spec.ts:79-84` over `[new Error('segredo'), 'segredo']`: `toBe(500)`, `toEqual({ error: 'Internal server error' })`, `not.toContain('segredo')`. `api/test/errors.e2e-spec.ts:134-137` 500, exact body, `not.toContain('segredo')`, `not.toContain('at ')` | PASS |
| C8 | an `Error` is logged with its stack by `Logger.error` | unit `logs the stack` ✓ | `api/src/common/filters/all-exceptions.filter.spec.ts:93-94` `toHaveBeenCalledTimes(1)`, `mock.calls[0]).toContain(error.stack)` | PASS |
| C9 | DB up: `GET /health` gives 200 with exactly `{ status: "ok" }` | e2e `returns 200 when the database answers` ✓. Unit `ok when select 1 succeeds` ✓ | `api/test/health.e2e-spec.ts:24-25` `toBe(200)`, `toEqual({ status: 'ok' })`. `api/src/modules/health/health.service.spec.ts:10` `toHaveBeenCalledWith('SELECT 1')` | PASS |
| C10 | `SELECT 1` rejects, so 503 `{ error: "Database unavailable" }` | unit `503 when the query fails` ✓ | `api/src/modules/health/health.controller.spec.ts:18-19` `getStatus()).toBe(503)`, `message).toBe('Database unavailable')`. Level gap, see Gaps #2 | PASS |
| C11 | still pending at 3000 ms gives 503. Answered at 2999 ms gives 200 | unit `503 after 3000 ms without an answer, 200 when it answers at 2999 ms` ✓ | `api/src/modules/health/health.controller.spec.ts:39-40` advance 3000 then `expectUnavailable` (503 at `:18`). `:43-47` resolve at 2999 then `resolves.toEqual({ status: 'ok' })` | PASS |
| C12 | `GET /` gives 404 `{ error }`, and no response contains `Hello World` | e2e `root returns 404` ✓ | `api/test/health.e2e-spec.ts:30-32` `toBe(404)`, `keys toEqual(['error'])`, `not.toContain('Hello World')`. `grep -rn "Hello World" api/src api/test web/src` hits only that assertion line | PASS |
| C13 | no `PORT` gives 3001, and `PORT=4000` gives 4000 | unit `resolves the port` ✓ | `api/src/app.setup.spec.ts:5,7` `resolvePort({})).toBe(3001)`, `resolvePort({ PORT: '4000' })).toBe(4000)`. Used by `api/src/main.ts:9` | PASS |
| C14 | `synchronize: false` for the app options and the CLI data source, across dev/test/prod | unit `synchronize is always false` ✓ | `api/src/database/typeorm-options.spec.ts:7` `buildTypeOrmOptions(...).synchronize).toBe(false)` and `:12` `dataSource.options.synchronize).toBe(false)`, per `NODE_ENV` in `:5`. Assemblies: `api/src/app.module.ts:13` and `api/src/database/data-source.ts:12` both spread `buildTypeOrmOptions`, which sets `synchronize: false` at `api/src/database/typeorm-options.ts:15` | PASS |
| C15 | `migration:run` on an empty DB exits 0 and creates `migrations` | C15 command ✓ exit 0 | the proof's own `test "$(... to_regclass('public.migrations'))" = "migrations"`. Migrations glob at `api/src/database/data-source.ts:14`. The same fact at `api/test/database.e2e-spec.ts:33` `toBe('migrations')` | PASS |
| C16 | with `forge_test` dropped, `test:e2e` recreates it, migrates it and exits 0 | C16 proof 1 ✓ exit 0 (DROP printed, 11/11). Proof 2 `migrations table exists` ✓ | `api/test/database.e2e-spec.ts:33` `expect(rows[0].table).toBe('migrations')`. Creation at `api/test/global-setup.ts:20`, migrate at `:26` | PASS |
| C17 | during e2e, `current_database()` is `forge_test`, not `DB_NAME` | exact C17 command with `DB_NAME=forge` ✓ | `api/test/database.e2e-spec.ts:26` `expect(rows[0].current_database).toBe('forge_test')` | PASS |
| C18 | shell has a header with `Brios3D Forge`, an empty `nav` and a `main` with the children | web `renders header, empty nav and content` ✓ | `web/src/components/app-shell.test.tsx:16,19,22` header `getByText("Brios3D Forge")`, nav `queryAllByRole("link")).toHaveLength(0)`, main contains the child. Assembly: `web/src/app/layout.tsx:28` wraps children in `AppShell` | PASS |
| C19 | pending `/health` shows `Verificando a API…` | web `shows loading` ✓ | `web/src/components/health-status.test.tsx:26` `getByText("Verificando a API…")`. Assembly: `web/src/app/page.tsx:7` renders `HealthStatus` | PASS |
| C20 | 200 shows `API ok` | web `shows API ok` ✓ | `web/src/components/health-status.test.tsx:32` `findByText("API ok")` | PASS |
| C21 | 503 `{ error: "Database unavailable" }` shows both texts. Client throws `ApiError` 503 with that message | web `shows the api error` ✓. `decodes the error body` ✓ | `web/src/components/health-status.test.tsx:42-43` `API indisponível`, `Database unavailable`. `web/src/lib/api.test.ts:41-42` `status).toBe(503)`, `message).toBe("Database unavailable")`, with `ApiError` instance at `:13` | PASS |
| C22 | `fetch` rejects, so `ApiError` status 0. Home shows both texts | `network failure` ✓. `shows the network error` ✓ | `web/src/lib/api.test.ts:50-51` `status).toBe(0)`, `message).toBe("Não foi possível conectar à API")`. `web/src/components/health-status.test.tsx:49-50` | PASS |
| C23 | base `http://api.test:3001` makes `fetch` get `http://api.test:3001/health` | `prefixes the base url` ✓ | `web/src/lib/api.test.ts:30` `fetchMock.mock.calls[0][0]).toBe("http://api.test:3001/health")` | PASS |
| C24 | empty base URL throws `ApiError("NEXT_PUBLIC_API_URL não configurada")` and makes 0 fetch calls | `missing base url` ✓ | `web/src/lib/api.test.ts:60-61` `message).toBe("NEXT_PUBLIC_API_URL não configurada")`, `toHaveBeenCalledTimes(0)`. Instance at `:13` | PASS |
| C25 | 502 with an `<html>` body throws `ApiError` 502 `Erro 502 da API` | `non error body` ✓ | `web/src/lib/api.test.ts:77-78` `status).toBe(502)`, `message).toBe("Erro 502 da API")` | PASS |
| C26 | `.env.example` declares the 9 keys | C26 command ✓ exit 0 | `.env.example:2,3,4,5,6,8,11,12,15`: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_NAME_TEST`, `PORT`, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL` | PASS |
| C27 | git ignores `api/tsconfig.build.tsbuildinfo` and `web/tsconfig.tsbuildinfo` | C27 command ✓ exit 0 | `.gitignore:6` `*.tsbuildinfo`. See Gaps #3 | PASS |
| C28 | valid workflow on push and PR to `main` that runs every AC 28 command in the `api` and `web` jobs, all of them passing locally | actionlint ✓, grep ✓, local chain ✓ (all exit 0) | `.github/workflows/ci.yml:3-7` push and pull_request on `[main]`. `:14` `postgres:17`. `:41-44` api lint/test/build/test:e2e. `:58-60` web lint/test/build. Go-live gap, see Gaps #1 | PASS |
| C29 | `docker compose up` brings up db/api/web. `main.ts` API answers `/health` 200, `/nada` 404 `{ error }` and malformed 400 `{ error }`. web answers 200 on 3000 | C29 command ✓ exit 0 | `api/scripts/smoke.mjs:22` `response.status === status`, `:25` `keys.length === 1 && keys[0] === 'error' && ... json.error.length > 0`, `:29` exits 1 on any failure. Assembly: `api/src/main.ts:8` `configureApp(app)`, the same `api/src/app.setup.ts:7-15` the e2e uses (`api/test/errors.e2e-spec.ts:57`) | PASS |

## Gaps

These are ranked. None of them is a check without evidence or a failing proof, so the verdict
stays PASS. Each one is recorded for follow-up.

1. **Go-live gap for C28**: the workflow has not run on GitHub (open question 1, no push
   authorized). Local proofs are actionlint, the grep and the same commands locally. Two things
   stay unproven until a real run: the GitHub `services: postgres` wiring (`.github/workflows/ci.yml:12-32`)
   and `npm ci` against the lockfiles on `ubuntu-latest`. The ROADMAP acceptance criterion
   "A CI passa em um push" is still open.
2. **Level gap for C10 (and C11)**: the 503 claims name a status and a body, but their proofs sit
   below the HTTP boundary, at `api/src/modules/health/health.controller.spec.ts:18-19`. They
   assert on the thrown `HttpException`, not on the response body. `checks.md` names this and gives
   the reason. Body mapping for an `HttpException` with a string message is proven separately at
   `api/src/common/filters/all-exceptions.filter.spec.ts:61-62`. My extra `docker compose pause db`
   run showed the timeout path (C11) end to end on the production assembly:
   `503 {"error":"Database unavailable"}` in 3.003 s. The reject path (C10) has no HTTP-level
   evidence beyond this composition.
3. **Precision/sampling gap for C27**: AC 27 says `*.tsbuildinfo` "in any folder", but C27 samples
   two paths. `.gitignore:6` is an unanchored `*.tsbuildinfo`, and
   `git check-ignore -v foo/bar/x.tsbuildinfo` matched it, so the behaviour holds. The check was
   narrower than its AC.
4. **Sampling gap for C12**: "nenhuma resposta contém `Hello World`" is asserted on `GET /` only
   (`api/test/health.e2e-spec.ts:32`). A tree-wide grep backs it up: the string appears only in that
   assertion.

Residual items from the binding sources. These are outside the checks and belong to the
orchestrator, not the Verifier:

- ROADMAP asks for the home's ok and error states to be "verificado com Playwright", and
  `AGENTS.md` asks for Playwright MCP validation when a change touches screens. No check carries
  this, and this report did not perform it.
- `AGENTS.md` asks for roadmap items to be marked done. `ROADMAP.md` still shows Fase 0 as `⬜`,
  with every task unchecked.
- The C15 proof leaves a `forge_migrate_check` database behind in the dev Postgres. This is
  harmless, and is recorded as a side effect of the proof.

## Gate

`api` unit 10 passed, 0 failed. `api` e2e 11 passed, 0 failed. `web` 10 passed, 0 failed. The
C15, C26, C27, C28 (three commands) and C29 command proofs all exited 0.
