# Fase 2 — Dados de impressão pela URL do MakerWorld verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 5df0c52..6f4a6ed
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

All 41 checks are green at `6f4a6ed`, and each has a located assertion. The verdict is FAIL because
3 of 10 distinct injected faults survived and the recomputed Coverage leaves members unproven:

1. **Door 4 (`node:https`, AD-011) is never exercised.** Every client test uses an `http://` base URL.
   `makerworld.client.ts:86` picks `node:http` for that base URL and `node:https` for everything
   else. Changing the `https` branch to `httpGet` breaks every real import (`ERR_INVALID_PROTOCOL`,
   then 502), and the whole API unit suite still passes (72/72).
2. **The rounding in `formatPrintTime` is unproven.** C41's "rounds up" case uses `89` s, which is
   1.48 min, so `round` and `floor` both give `0 h 1 min`. `Math.round` -> `Math.floor` at
   `format-print-time.ts:8` passes the whole web suite (19/19).
3. **The `@MaxLength(2048)` refusal on `url` is untested.** Removing it from
   `import-print-profile.dto.ts:5` passes the whole e2e file (7/7).

## Binding sources

Step 1 runs only under `ui`, and this feature was approved under `standard`. The plan also marks no
source as binding. `Sources` lists `ROADMAP.md` and the MakerWorld response of 2026-09-21 only as
provenance. No comparison was owed.

## Checks

The API unit proofs ran in one invocation:
`npm --prefix api run test -- <5 spec files> -t "<25 names joined by |>" --reporter=verbose`. It
exited 0, and each of the 25 names was listed individually as passed. The e2e proofs ran as
`npm --prefix api run test:e2e -- test/print-profiles.e2e-spec.ts -t "<7 names>"`, exited 0, and
listed 7/7 individually. The web proofs ran as
`npm --prefix web run test -- <3 files> -t "<9 names>"`, exited 0, and listed 9/9 individually.
C33 is a shell proof, and it exited 0. Every proof test was added in 5df0c52..HEAD. None resolves
to a test that existed before the feature.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | 7 accepted URLs parse; the ROADMAP URL gives profileId 3387944, the other 6 give null | url spec `accepts makerworld model urls` ✓ | `api/src/modules/print-profiles/makerworld-url.spec.ts:25` - `toEqual({ designId: 3007827, profileId: 3387944 })`; `:36` - `toEqual({ designId: 3007827, profileId: null })` over 6 URLs | PASS |
| C2 | 8 invalid inputs -> 400 + exact message | url spec `rejects non makerworld urls` ✓ | `makerworld-url.spec.ts:53` - `expect(error.status, url).toBe(400)`; `:54` - `toBe(INVALID_URL)` (literal at `:4-5`) | PASS |
| C3 | malformed fragment -> profileId null | url spec `ignores malformed profile fragment` ✓ | `makerworld-url.spec.ts:60-63` - `toEqual({ designId: 3007827, profileId: null })` over 3 fragments | PASS |
| C4 | Sea star scalars, printer, settings | mapper spec `maps the sea star profile` ✓ | `makerworld-design.mapper.spec.ts:73-80` - `selectedProfileId toBe(3387944)`, `printSeconds toBe(1707)`, `printer toEqual({ name: 'X2D', nozzleDiameterMm: 0.4 })`, `settings toEqual({ layerHeightMm: 0.2, wallLoops: 2, sparseInfillRate: 0.15 })` | PASS |
| C5 | Sea star filaments by slot and the single plate | mapper spec `sea star filaments by slot` ✓ | `makerworld-design.mapper.spec.ts:85` - `toEqual(SEA_STAR_FILAMENTS)` (literal at `:10-13`); `:86-88` - plates `toEqual([{ index: 1, printSeconds: 1707, totalGrams: 9, ... }])` | PASS |
| C6 | model and source | mapper spec `maps model and source` ✓ | `makerworld-design.mapper.spec.ts:93` - `toEqual(MODEL)` (literal at `:31-37`); `:94-98` - source literal | PASS |
| C7 | 11 plates, 77054 s, 408 g, per-slot grams, colors, and meters to 1e-9 | mapper spec `sums plate filaments by slot` ✓ | `makerworld-design.mapper.spec.ts:103-114` - `toHaveLength(11)`, index `[1..11]`, `toBe(77054)`, `toBe(408)`, 4-slot literal; `:117` - `toBeLessThan(1e-9)` against `[79.82, 19.42, 11.86, 19.62]` | PASS |
| C8 | no profileId -> defaultInstanceId 3377800 | mapper spec `defaults to the default instance` ✓ | `makerworld-design.mapper.spec.ts:122` - `.selectedProfileId).toBe(3377800)` | PASS |
| C9 | profile order | mapper spec `keeps profile order` ✓ | `makerworld-design.mapper.spec.ts:127` - `toEqual([3387944, 3388305, 3377800])` | PASS |
| C10 | Sea shell needsAms false | mapper spec `needs ams false` ✓ | `makerworld-design.mapper.spec.ts:131` - `.needsAms).toBe(false)` | PASS |
| C11 | each of the 19 scalars removed -> null, the rest unchanged | mapper spec `missing field becomes null` ✓ | `makerworld-design.mapper.spec.ts:177` - `toHaveLength(19)`; `:202-203` - `toEqual(expectedModel)` / `toEqual(expectedProfile)`, where the expected objects are the C4–C6 literals (`:15-37`) with that one key set to null | PASS |
| C12 | invalid numbers -> null; "2.66" -> number | mapper spec `invalid numbers become null` ✓ | `makerworld-design.mapper.spec.ts:212-213` - `grams toBeNull()` for `abc`,`-1`,`""`; `:218` - `printSeconds toBeNull()`; `:221-222` - `toBe(2.66)`, `typeof ... toBe('number')` (the fixture holds `usedM` as the string `"2.66"`) | PASS |
| C13 | color, rate, layer height, wall loops normalization | mapper spec `normalizes color and rates` ✓ | `makerworld-design.mapper.spec.ts:231-243` - `toBe('#FD8008')`, `toBeNull()` x2, `toBe(0.15)`, `toBeNull()`, `toBe(0.2)`, `toBe(2)` | PASS |
| C14 | no plates -> instanceFilaments with sequential slots | mapper spec `falls back to instance filaments` ✓ | `makerworld-design.mapper.spec.ts:250-254` - `plates toEqual([])`, filaments slot 1/2 literal | PASS |
| C15 | `instances: []` and missing instances -> [] and null | mapper spec `model without profiles` ✓ | `makerworld-design.mapper.spec.ts:264-265` - `toEqual([])`, `toBeNull()` | PASS |
| C16 | unknown profileId 999 -> 400 + message | mapper spec `unknown profile id` ✓ | `makerworld-design.mapper.spec.ts:271-274` - `toBe(400)`, exact message literal | PASS |
| C17 | `[]`, `null`, `"texto"`, `{}` -> 502 + message | mapper spec `unrecognized design is 502` ✓ | `makerworld-design.mapper.spec.ts:280-281` - `toBe(502)`, `toBe(UNAVAILABLE)` | PASS |
| C18 | one GET to the design path with accept and user-agent; returns the JSON | client spec `requests the design endpoint` ✓ | `makerworld.client.spec.ts:104-110` - `resolves.toEqual({ id: 3007827, title: 'x' })`, `toHaveLength(1)`, `url toBe('/api/v1/design-service/design/3007827')`, `accept toBe('application/json')`, `user-agent toBe(\`Brios3DForge/${VERSION}\`)` | PASS |
| C19 | default baseUrl, timeout, maxBytes | client spec `default limits` ✓ | `makerworld.client.spec.ts:117-121` - `toEqual({ baseUrl: 'https://makerworld.com', timeoutMs: 10000, maxBytes: 5242880 })` | PASS |
| C20 | upstream 404 -> 404 + message | client spec `upstream 404` ✓ | `makerworld.client.spec.ts:132-133` - `toBe(404)`, `toBe('Modelo 3007827 não encontrado no MakerWorld')` | PASS |
| C21 | 7 upstream failures -> 502; the redirect makes one request | client spec `upstream failures are 502` ✓ | `makerworld.client.spec.ts:140` - `toHaveLength(7)`; `:153-156` - `toBe(502)`, `toBe(UNAVAILABLE)`, redirect `requests toHaveLength(1)` | PASS |
| C22 | warn with designId and reason; the message leaks no reason | client spec `logs upstream failure` ✓ | `makerworld.client.spec.ts:181-186` - `toHaveBeenCalledTimes(1)`, `toContain('3007827')`, `toContain(failure.reason)`, `not.toContain(other.reason)` | PASS |
| C23 | timeout 200 ms rejects in < 2 s | client spec `timeout aborts the request` ✓ | `makerworld.client.spec.ts:204-205` - `toBe(502)`, `toBeLessThan(2000)` | PASS |
| C24 | route 200 with the full Sea star contract | e2e `imports the sea star profile` ✓ | `api/test/print-profiles.e2e-spec.ts:59` - `status toBe(200)`; `:66-90` - source, model, `selectedProfileId toBe(3387944)`, `profiles toHaveLength(3)`, full profile literal `toEqual` | PASS |
| C25 | the fake client gets exactly one numeric designId | e2e `client receives only the design id` ✓ | `print-profiles.e2e-spec.ts:95-96` - `calls toEqual([3007827])`, `typeof ... toBe('number')` | PASS |
| C26 | printables URL -> 400 exact body; client not called | e2e `invalid url returns 400` ✓ | `print-profiles.e2e-spec.ts:101-105` - `toBe(400)`, `body toEqual({ error: 'URL inválida: ...' })`, `calls toEqual([])` | PASS |
| C27 | body validation 400s | e2e `body validation` ✓ | `print-profiles.e2e-spec.ts:110-119` - `toBe(400)` x3, `toContain('url')` x2, `toContain('should not exist')` | PASS |
| C28 | unknown profile -> 400 exact body | e2e `unknown profile returns 400` ✓ | `print-profiles.e2e-spec.ts:124-128` - `toBe(400)`, `body toEqual({ error: 'Perfil 999 ...' })` | PASS |
| C29 | 404 and 502 exact bodies; /health 200 afterwards | e2e `upstream errors` ✓ | `print-profiles.e2e-spec.ts:135-144` - `toBe(404)`, `toEqual({ error: 'Modelo 3007827 ...' })`, `toBe(502)`, `toEqual({ error: UNAVAILABLE })`, `health.status toBe(200)` | PASS |
| C30 | `instances: []` at the route -> 200, [] and null | e2e `model without profiles returns 200` ✓ | `print-profiles.e2e-spec.ts:150-153` - `toBe(200)`, `toEqual([])`, `toBeNull()` | PASS |
| C31 | 400/404/502 -> BadRequest/NotFound/BadGateway, same message | controller spec `maps domain errors to http` ✓ | `print-profiles.controller.spec.ts:28-30` - `toBeInstanceOf(type)`, `getStatus() toBe(status)`, `message toBe(\`erro ${status}\`)` | PASS |
| C32 | the token resolves to HttpMakerWorldClient; AppModule imports the module | module spec `wires the http client` ✓ | `print-profiles.module.spec.ts:9` - `toBeInstanceOf(HttpMakerWorldClient)`; `:13` - regex over `app.module.ts`. Assembly read directly: `app.module.ts:21` lists `PrintProfilesModule`, `main.ts:6` creates `AppModule` | PASS |
| C33 | no typeorm import under print-profiles | `test -z "$(grep -rlE ...)"` exit 0 | `api/src/modules/print-profiles/print-profiles.module.ts:6-12` - module with no `TypeOrmModule`; `grep -rn typeorm api/src/modules/print-profiles` returns 0 lines | PASS |
| C34 | form filled from the import, swatches colored | web `fills the form from the import` ✓ | `web/src/components/print-profile-import.test.tsx:64-68` - Horas `"0"`, Minutos `"28"`, AMS `checked true`, `X2D`, `0,4`; `:71-82` - 2 rows, slot/type/color/grams literal, `swatch.style.backgroundColor toBe('rgb(253, 128, 8)')` | PASS |
| C35 | "Importando…" and the button disabled | web `shows importing` ✓ | `print-profile-import.test.tsx:90-93` - `getByText("Importando…")`, `disabled toBe(true)` | PASS |
| C36 | 3 labelled options, switch without refetch | web `switches profile without refetch` ✓ | `print-profile-import.test.tsx:104-117` - `toHaveLength(3)`, `"Sea star · 0 h 28 min · 9 g"`, `select.value toBe("3387944")`, `"21"`/`"24"`, 4 rows, `toHaveBeenCalledTimes(1)` | PASS |
| C37 | null fields blank and editable | web `null fields are blank and editable` ✓ | `print-profile-import.test.tsx:131-138` - `toBe("")` x2, then `toBe("A1 mini")`, `toBe("7,5")` | PASS |
| C38 | 502 message and API-down message, each with a blank form | web `error shows message and blank form` ✓ | `print-profile-import.test.tsx:145-155` - `findByText(UNAVAILABLE)`, `expectBlankForm()` (`:32-39`), `findByText("Não foi possível conectar à API")` | PASS |
| C39 | no profiles -> message + blank form | web `model without profiles` ✓ | `print-profile-import.test.tsx:163-168` - `findByText("Este modelo não tem perfis ...")`, `expectBlankForm()` | PASS |
| C40 | initial blank form, add x2, remove 1 | web `blank form and filament rows` ✓ | `print-profile-import.test.tsx:176-195` - `expectBlankForm()`, `not.toHaveBeenCalled()`, `toHaveLength(2)`, `toHaveLength(1)`, the remaining row is `"PETG"` | PASS |
| C41 | nav link + formatPrintTime 4 cases | web `links to print profiles` ✓ + `rounds to the nearest minute` ✓ | `web/src/components/app-shell.test.tsx:31-32` - `getByRole("link", { name: "Importar do MakerWorld" })`, `href toBe("/print-profiles")`; `web/src/lib/format-print-time.test.ts:6-9` - the 4 literals. The claimed values hold, but see precision gap P1 | PASS |

Precision gaps (findings about the checks, not the code):

- **P1 - C41 / "formatação do tempo" row.** `89` is labelled "arredonda para cima", but 89 s is
  1.483 min, so truncation also gives `0 h 1 min`. No case in C41 or C36 separates
  round-to-nearest from `floor`: 1707 s is 28.45 min, 1984 s is 33.07 min and 77054 s is
  1284.2 min. The assumption "Tempo na tela" (nearest minute) is therefore unproven. A value such
  as `90` (-> `0 h 2 min`) would pin it. Mutant F6 survived.
- **P2 - C34 wording.** "mostra o tempo `0 h 28 min`" is proven as two inputs, Horas `0` and
  Minutos `28`, not as that literal string. The literal appears only in the selector label (C36).
  This is an acceptable reading of AC 21 for an editable form, so it is recorded as a note and not
  as a failure.

Other notes:

- `web/src/components/fixtures/print-profile-import.json` was compared with the real mapper output.
  Running `mapMakerWorldDesign` from the built `api/dist` over the API fixture with `profileId`
  3387944 and comparing with `JSON.stringify` gives `equal: true`. So the web proofs use the
  response C24 proves, and the web fixture has not drifted from the API contract.
- **The `app-shell.test.tsx` edit is legitimate.** The removed assertion
  `within(nav).queryAllByRole("link")).toHaveLength(0)` encoded the Phase-0 placeholder of an
  empty nav. AC 29 changes exactly that behaviour. The replacement keeps the nav landmark
  assertion (`app-shell.test.tsx:18`). The new test asserts the link's name and href (`:31-32`).
  Residual: nothing bounds the nav to exactly one link, which is minor.
- **Door 4 deviation.** The code matches the door-4 literal shape: `new URL(...)` at
  `makerworld.client.ts:81`, headers at `:94-97`, `signal` at `:93`, 3xx -> `redirect` at `:115`,
  and `data` counting with `destroy` above `maxBytes` at `:127-133`. AD-011 is recorded in
  `.specs/STATE.md`. What is not proven is that the `https` branch is taken; see Coverage and F9.

## Coverage

Recomputed from the authority for each set: plan `Surface`/`Landing`/`Criteria` where the code must
satisfy the set, and the code's own branches where the code is where the set is discovered.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| route statuses (4) | plan `Surface` | 200 C24, C30 · 400 C26, C27, C28 · 404 C29 · 502 C29 | - |
| accepted URLs (7) | plan AC 8 (`/pt/`, `/en/`, `www.`, slug, query) | all 7 in C1 (`makerworld-url.spec.ts:23-34`) | - |
| refused URLs, plan AC 13 (8) | plan AC 13 (scheme, host, path) | all 8 in C2 (`makerworld-url.spec.ts:42-49`) | - |
| refusal branches of `parseMakerWorldUrl` (code, 7) | `makerworld-url.ts:15-33` | parse failure C2 · scheme C2 · host C2 · port C2 · path C2 · userinfo (`:23-24`) none · `designId <= 0` (`:31`, e.g. `/models/0`) none | userinfo; designId 0 |
| profile fragment (3) | `makerworld-url.ts:35-39` | valid C1 · malformed C3 · absent C1, C8 | - |
| nullable scalars (19) | door 1 ("todo campo escalar ... pode ser null") and `print-profiles.types.ts` | 4 model + 4 profile + 2 printer + 3 settings + 4 filament + 2 plate = 19, table-driven in C11 (`mapper.spec.ts:141-177`) | - |
| invalid numbers (4) | AC 10, `toNonNegative` `mapper.ts:174-182` | "abc", negative, "", "2.66" all in C12 | - |
| format normalization (4) | door 1, `mapper.ts:184-206` | color, rate, layer height, wall loops in C13 | - |
| filament origin (2) | `mapper.ts:92-95` | plates C5, C7 · instanceFilaments C14 | - |
| profile selection (code, 4 branches) | `selectProfile` `mapper.ts:46-66` | given and existing C4 · given and unknown C16, C28 · absent -> defaultInstanceId C8 · absent with default missing or not among instances -> `ids[0]` (`:65`) none · no profiles -> null C15 | `ids[0]` fallback |
| fixture profiles (3) | fixture `instances[]` | 3387944 C4, C5 · 3377800 C7 · 3388305 C10 | - |
| unrecognized response (4) | AC 17 last clause, `mapper.ts:19-22` | `[]`, `null`, `"texto"`, `{}` in C17 | - |
| upstream failures (7) | AC 17 and `makerworld.client.ts:65-76,100-137` | timeout C21, C23 · 500 C21 · 403 C21 · 301 C21 · too large C21 (streamed path) · invalid json C21 · network C21; each logged C22 | - |
| domain -> HTTP (3) | `print-profiles.controller.ts:35-43` | 400, 404, 502 in C31, and at the route C26/C28, C29 | - |
| request body refusals (code, 4) | `ImportPrintProfileDto` + `ValidationPipe` `app.setup.ts:9-13` | missing C27 · not text C27 · extra key C27 · `url` > 2048 chars (`dto:5`) none | url > 2048 (mutant F10 survived) |
| screen states (5) | plan `Observable` + AC 21-28 | idle C40 · loading C35 · loaded C34 · error (API and network) C38 · empty C39 | - |
| filament row actions (2) | AC 27 | add C40 · remove C40 | - |
| time formatting (4) | assumption "Tempo na tela" (nearest minute) | 1707 C41 · 77054 C41 · "rounds up" 89 does not round up (1.48 min) · rounds down 29 C41 | rounds up (mutant F6 survived) |
| one-way doors (4, not 3: door 4 was added in range) | plan `Landing` at HEAD | 1 contract C24, C13 · 2 source/interface C18, C32 · 3 redirect/timeout/size/fixed host/designId only C18, C19, C21, C23, C25 · 4 `node:https` transport none: every client test uses an `http://` base and so takes `httpGet` (`makerworld.client.ts:86`) | door 4 `https` branch (mutant F9 survived) |
| startup config (2) | assemblies read directly | `main.ts:6` -> `AppModule` -> `app.module.ts:21` `PrintProfilesModule` (C32 regex) · token -> `HttpMakerWorldClient` `print-profiles.module.ts:10` (C32) | - |

Swept: no `Swept` row resolves to an existing constraint that could be missing. The only
pre-existing constraint in the flow is the `ValidationPipe` with `forbidNonWhitelisted`, and it is
present at `app.setup.ts:9-13`. The `n/a` rows are approved policy.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached through the route | `makerworld-url.ts`, `makerworld-design.mapper.ts` | route C24–C30 · own layer C1–C17 | no - gap: one case per decision-table row is missing for the userinfo and `designId <= 0` refusals (`makerworld-url.ts:23-24,31`) and the `ids[0]` fallback (`makerworld-design.mapper.ts:65`) |
| Decides, outside the route (HTTP client) | `makerworld.client.ts` | own layer against a local server, C18–C23 | yes - all 7 failures, 404 and the happy path are members. The `https` transport gap is recorded under doors and F9 |
| Input that does not decide (controller) | `print-profiles.controller.ts`, `dto/import-print-profile.dto.ts` | route C24, C26–C30 (+ C31 at its own layer) | no - gap: the refusal of `url` longer than 2048 chars is not proven at the route (F10 survived) |
| Screen component | `print-profile-import.tsx`, `app-shell.tsx`, `format-print-time.ts` | Testing Library C34–C41 | yes - all 5 screen states are members; the rounding gap is recorded under P1 and F6 |

## Faults injected

Isolation: a `git worktree add --detach <scratchpad>/wt HEAD` with the real `node_modules`
symlinked. The real tree's porcelain was recorded first (`?? .playwright-mcp/`). Each mutant was
applied by an exact single-occurrence replacement and reverted with `git checkout -- <file>`.
After `git worktree remove`, the real tree's porcelain matched the baseline.

The five-fault cap in `verify.md` was deliberately exceeded, because the orchestrator required at
least one fault per assertion surface. There are 9 proof files: url spec, mapper spec, client spec,
controller spec, module spec, e2e, component test, app-shell test and format test. That gives 10
distinct mutants. F2 and F4 were each run against two surfaces.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 drop the port check (`url.port !== ''`) | `api/src/modules/print-profiles/makerworld-url.ts:23` | yes - C2 `rejects non makerworld urls` |
| F2 unknown profileId no longer throws | `api/src/modules/print-profiles/makerworld-design.mapper.ts:54` | yes - C16 `unknown profile id` (mapper spec) and C28 `unknown profile returns 400` (e2e) |
| F3 drop the streamed size limit (`total > maxBytes`) | `api/src/modules/print-profiles/makerworld.client.ts:129` | yes - C21 `upstream failures are 502` |
| F4 404 -> `BadGatewayException` | `api/src/modules/print-profiles/print-profiles.controller.ts:40` | yes - C31 `maps domain errors to http` (controller spec) and C29 `upstream errors` (e2e: `expected 502 to be 404`) |
| F5 token wired to a non-HTTP client object | `api/src/modules/print-profiles/print-profiles.module.ts:10` | yes - C32 `wires the http client` |
| F6 `Math.round` -> `Math.floor` in `splitPrintTime` | `web/src/lib/format-print-time.ts:8` | no - survived C41 and the whole web suite (19/19) |
| F7 `needsAms` forced to `false` in the form | `web/src/components/print-profile-import.tsx:67` | yes - C34 `fills the form from the import` |
| F7b button never disabled while loading | `web/src/components/print-profile-import.tsx:160` | yes - C35 `shows importing` |
| F8 nav href `/print-profiles` -> `/print-profile` | `web/src/components/app-shell.tsx:18` | yes - C41 `links to print profiles` |
| F9 `https` branch uses `httpGet` (door 4 transport) | `api/src/modules/print-profiles/makerworld.client.ts:86` | no - survived the client and module specs and the whole API unit suite (72/72); in production every import would 502 |
| F10 drop `@MaxLength(2048)` on `url` | `api/src/modules/print-profiles/dto/import-print-profile.dto.ts:5` | no - survived the whole e2e file (7/7) |

## Gate

Run in the scratch worktree at `6f4a6ed`:

- `npm --prefix api run test` - 72 passed, 0 failed (14 files)
- `npm --prefix api run test:e2e` - 28 passed, 0 failed (5 files)
- `npm --prefix web run test` - 19 passed, 0 failed (5 files)
- `npm --prefix api run lint` and `npm --prefix web run lint` - clean
- `npm --prefix api run build` and `npm --prefix web run build` - exit 0; `/print-profiles` is
  prerendered

## Ranked gaps

1. Door 4 `node:https` transport unproven - Coverage "one-way doors" row, F9 -
   `api/src/modules/print-profiles/makerworld.client.ts:86`. Add a proof that the `https` base
   goes through `node:https`'s `get` with the door-4 options, for example `vi.mock('node:https')`
   or a local TLS server with a self-signed certificate.
2. Nearest-minute rounding unproven - C41 precision gap P1, F6 - `web/src/lib/format-print-time.ts:8`
   and `web/src/lib/format-print-time.test.ts:8`. Replace or add a case that only rounding
   satisfies, for example `90` -> `0 h 2 min`.
3. `url` > 2048 chars refusal unproven - Test policy row "controller", F10 -
   `api/src/modules/print-profiles/dto/import-print-profile.dto.ts:5`.
4. Decision branches with no case: the userinfo and `designId <= 0` refusals
   (`api/src/modules/print-profiles/makerworld-url.ts:23-24,31`) and the fallback to the first
   profile when `defaultInstanceId` is missing or unknown
   (`api/src/modules/print-profiles/makerworld-design.mapper.ts:65`).

## Lessons

The Verifier was told to change nothing outside this report, so `scripts/lessons.py` was not run.
It writes `.specs/lessons.json` and `.specs/LESSONS.md`. Proposed lessons for the orchestrator:

- A mid-build one-way door added to `Landing` needs its own check row. The doors set grew from 3
  to 4 while `checks.md` stayed frozen, and the new door's defining element went unproven.
- A "rounds up/down" formatting case has to straddle the .5 boundary. Otherwise truncation passes
  it.
