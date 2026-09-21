# Fase 2 — Dados de impressão pela URL do MakerWorld verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 5df0c52..19ce72b
**Round**: 2 - full (every proof re-run, every surface re-injected, coverage recomputed at `19ce72b`)
**Verifier**: independent sub-agent (author != verifier)

Round 1 (at `6f4a6ed`, report committed in `19ce72b`): FAIL. C1–C41 were proven, but mutants F9 (https
transport), F6 (`Math.round` -> `Math.floor`) and F10 (drop `@MaxLength(2048)`) survived, and the
userinfo refusal, the `designId <= 0` refusal and the first-profile fallback had no case.

All 46 checks are green at `19ce72b`, and each has a located assertion. The three round-1 mutants
were re-injected and **all three now die**: F9 by C42, F6 by C43 and F10 by C44. The C45 and C46
surfaces also kill their own mutants. The verdict is still FAIL, because 8 of the 20 mutants
survived. All 8 are new probes, and they cover members that the recomputed Coverage shows are
unproven:

1. **The plate sum lets a missing value through.** `sumOrNull` (`makerworld-design.mapper.ts:151-153`)
   is meant to leave the total `null` when one plate lacks a value, because "a partial total would
   look complete" (comment at `:133-134`). Changing it to `(a ?? 0) + (b ?? 0)` passes the entire
   API unit suite and the entire e2e suite (G3). C11 removes fields only from the Sea star, which
   has a single plate, so the summing path never sees a `null`. With the mutant, a profile whose
   plate 3 lacks `usedG` would report an understated gram total that looks complete. That is the
   same pricing error the plan was written to prevent (AC 9).
2. **The form is never shown to reset.** C38 and C39 assert a blank form only when the form was
   already blank before the import. Deleting `setForm(BLANK_FORM)` from the error path (G7) or from
   the no-profiles path (G9) passes the entire web suite. In the real flow, a failed import that
   follows a successful one would show the old profile's time, printer and filaments next to the
   error. AC 25 and AC 26 require a blank form.
3. **Door 1's non-null identifiers have no proof.** The plan says "`id`, `slot` e `index` nunca"
   (never null), but nothing tests malformed input. Each of these mutants passes the entire unit
   suite: letting an instance without `id` through (G4, `mapper.ts:26`), emitting a filament with
   no valid slot as `slot: 0` (G5, `mapper.ts:110`), and dropping the `position + 1` index fallback
   (G6, `mapper.ts:102`).
4. **The 2048 bound is proven from one side only.** C44 proves that a URL over 2048 characters is
   refused, but nothing proves that a long valid URL is accepted. `@MaxLength(2048)` ->
   `@MaxLength(100)` passes the whole e2e file (G1). With that mutant, a real MakerWorld URL with a
   long slug and query string would be rejected, which contradicts AC 8.
5. **A password-only userinfo is not tested (low).** C45 tests `user@` and `user:pass@`, and both
   are caught by the `username` test. Removing the `url.password !== ''` clause
   (`makerworld-url.ts:25`) passes the full unit suite (G2), so `https://:pass@makerworld.com/…` is
   an untested row. The unsafe-integer refusal (`Number.isSafeInteger`, `:31`, for example a
   20-digit id) also has no case. Neither row is required by AC 13: they are hardening that the code
   decided, and the Test policy asks for one case per decision row.

## Binding sources

Step 1 runs only under `ui`, and this feature was approved under `standard`. The plan marks no
source as binding: `Sources` lists `ROADMAP.md` and the MakerWorld response of 2026-09-21 only as
provenance. No comparison was owed. Verified at `19ce72b`.

## Checks

Verified at `19ce72b` (real tree, read-only runs):

- **API unit.** `npm --prefix api run test -- makerworld-url.spec.ts makerworld-design.mapper.spec.ts makerworld.client.spec.ts makerworld.client.https.spec.ts print-profiles.controller.spec.ts print-profiles.module.spec.ts -t "<28 names joined by |>" --reporter=verbose`
  exited 0 with 28 passed and 1 skipped (the non-proof `other errors are not converted`). Each of
  the 28 names is listed individually as ✓.
- **e2e.** `npm --prefix api run test:e2e -- test/print-profiles.e2e-spec.ts -t "<8 names>"` exited
  0 with 8/8 listed individually.
- **Web.** `npm --prefix web run test -- print-profile-import.test.tsx app-shell.test.tsx format-print-time.test.ts -t "<10 names>"`
  exited 0 with 10 passed and 1 skipped (the non-proof `renders header, nav and content`), each
  listed individually.
- **C33.** The shell proof exited 0.

Every proof test was added in 5df0c52..HEAD, and C42–C46 were added in `19ce72b`. None resolves to
a test from before the feature.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | 7 accepted URLs parse; the ROADMAP URL gives profileId 3387944, the other 6 give null | url spec `accepts makerworld model urls` ✓ | `api/src/modules/print-profiles/makerworld-url.spec.ts:25` - `toEqual({ designId: 3007827, profileId: 3387944 })`; `makerworld-url.spec.ts:36` - `toEqual({ designId: 3007827, profileId: null })` over 6 URLs | PASS |
| C2 | 8 invalid inputs -> 400 + exact message | url spec `rejects non makerworld urls` ✓ | `makerworld-url.spec.ts:53` - `error.status toBe(400)`; `makerworld-url.spec.ts:54` - `toBe(INVALID_URL)` (literal at `:4-5`) | PASS |
| C3 | malformed fragment -> profileId null | url spec `ignores malformed profile fragment` ✓ | `makerworld-url.spec.ts:60` - `toEqual({ designId: 3007827, profileId: null })` over 3 fragments | PASS |
| C4 | Sea star scalars, printer, settings | mapper spec `maps the sea star profile` ✓ | `makerworld-design.mapper.spec.ts:73` - `selectedProfileId toBe(3387944)`; `:75-80` - `'Sea star'`, `1707`, `9`, `true`, printer and settings literals | PASS |
| C5 | Sea star filaments by slot + single plate | mapper spec `sea star filaments by slot` ✓ | `makerworld-design.mapper.spec.ts:85` - `toEqual(SEA_STAR_FILAMENTS)` (literal `:10-13`); `:86-88` - plates literal | PASS |
| C6 | model and source | mapper spec `maps model and source` ✓ | `makerworld-design.mapper.spec.ts:93` - `toEqual(MODEL)` (literal `:31-37`); `:94-98` - source literal | PASS |
| C7 | 11 plates, 77054 s, 408 g, per-slot grams/colors, meters to 1e-9 | mapper spec `sums plate filaments by slot` ✓ | `makerworld-design.mapper.spec.ts:103-114` - `toHaveLength(11)`, index `[1..11]`, `77054`, `408`, 4-slot literal; `:117` - `toBeLessThan(1e-9)` | PASS |
| C8 | no profileId -> defaultInstanceId 3377800 | mapper spec `defaults to the default instance` ✓ | `makerworld-design.mapper.spec.ts:122` - `selectedProfileId toBe(3377800)` | PASS |
| C9 | profile order | mapper spec `keeps profile order` ✓ | `makerworld-design.mapper.spec.ts:127` - `toEqual([3387944, 3388305, 3377800])` | PASS |
| C10 | Sea shell needsAms false | mapper spec `needs ams false` ✓ | `makerworld-design.mapper.spec.ts:131` - `needsAms toBe(false)` | PASS |
| C11 | each of 19 scalars removed -> null, rest unchanged | mapper spec `missing field becomes null` ✓ | `makerworld-design.mapper.spec.ts:177` - `toHaveLength(19)`; `:202-203` - `toEqual(expectedModel)` / `toEqual(expectedProfile)` built from the C4–C6 literals. Claim holds as written; see precision gap P1 | PASS |
| C12 | invalid numbers -> null; "2.66" -> number | mapper spec `invalid numbers become null` ✓ | `makerworld-design.mapper.spec.ts:212-213` - `toBeNull()`; `:218` - `toBeNull()`; `:221-222` - `toBe(2.66)`, `typeof toBe('number')` | PASS |
| C13 | color, rate, layer height, wall loops | mapper spec `normalizes color and rates` ✓ | `makerworld-design.mapper.spec.ts:231-243` - `'#FD8008'`, `toBeNull()` x2, `0.15`, `toBeNull()`, `0.2`, `2` | PASS |
| C14 | no plates -> instanceFilaments, sequential slots | mapper spec `falls back to instance filaments` ✓ | `makerworld-design.mapper.spec.ts:250-254` - `plates toEqual([])`, slot 1/2 literal | PASS |
| C15 | `instances: []` / missing -> [] and null | mapper spec `model without profiles` ✓ | `makerworld-design.mapper.spec.ts:264-265` - `toEqual([])`, `toBeNull()` | PASS |
| C16 | unknown profileId 999 -> 400 + message | mapper spec `unknown profile id` ✓ | `makerworld-design.mapper.spec.ts:271-274` - `toBe(400)`, exact message literal | PASS |
| C17 | `[]`, `null`, `"texto"`, `{}` -> 502 + message | mapper spec `unrecognized design is 502` ✓ | `makerworld-design.mapper.spec.ts:280-281` - `toBe(502)`, `toBe(UNAVAILABLE)` | PASS |
| C18 | one GET to the design path with accept + user-agent; returns JSON | client spec `requests the design endpoint` ✓ | `makerworld.client.spec.ts:104-110` - `resolves.toEqual(...)`, `toHaveLength(1)`, url, accept, `` toBe(`Brios3DForge/${VERSION}`) `` | PASS |
| C19 | default baseUrl, timeout, maxBytes | client spec `default limits` ✓ | `makerworld.client.spec.ts:117-121` - `toEqual({ baseUrl: 'https://makerworld.com', timeoutMs: 10000, maxBytes: 5242880 })` | PASS |
| C20 | upstream 404 -> 404 + message | client spec `upstream 404` ✓ | `makerworld.client.spec.ts:132-133` - `toBe(404)`, exact message | PASS |
| C21 | 7 upstream failures -> 502; the redirect makes one request | client spec `upstream failures are 502` ✓ | `makerworld.client.spec.ts:140` - `toHaveLength(7)`; `:153-156` - `toBe(502)`, `toBe(UNAVAILABLE)`, `requests toHaveLength(1)` | PASS |
| C22 | warn with designId + reason; message leaks no reason | client spec `logs upstream failure` ✓ | `makerworld.client.spec.ts:181-186` - `toHaveBeenCalledTimes(1)`, `toContain('3007827')`, `toContain(failure.reason)`, `not.toContain(other.reason)` | PASS |
| C23 | timeout 200 ms rejects in < 2 s | client spec `timeout aborts the request` ✓ | `makerworld.client.spec.ts:204-205` - `toBe(502)`, `toBeLessThan(2000)` | PASS |
| C24 | route 200 with full Sea star contract | e2e `imports the sea star profile` ✓ | `api/test/print-profiles.e2e-spec.ts:59` - `status toBe(200)`; `print-profiles.e2e-spec.ts:66-90` - source, model, `3387944`, `toHaveLength(3)`, full profile literal | PASS |
| C25 | fake client gets exactly one numeric designId | e2e `client receives only the design id` ✓ | `print-profiles.e2e-spec.ts:95-96` - `toEqual([3007827])`, `typeof toBe('number')` | PASS |
| C26 | printables URL -> 400 exact body; client not called | e2e `invalid url returns 400` ✓ | `print-profiles.e2e-spec.ts:101-105` - `toBe(400)`, `body toEqual({ error: 'URL inválida: …' })`, `calls toEqual([])` | PASS |
| C27 | body validation 400s | e2e `body validation` ✓ | `print-profiles.e2e-spec.ts:110-119` - `toBe(400)` x3, `toContain('url')` x2, `toContain('should not exist')` | PASS |
| C28 | unknown profile -> 400 exact body | e2e `unknown profile returns 400` ✓ | `print-profiles.e2e-spec.ts:124-128` - `toBe(400)`, exact body | PASS |
| C29 | 404 / 502 exact bodies; /health 200 after | e2e `upstream errors` ✓ | `print-profiles.e2e-spec.ts:135-144` - `toBe(404)`, body, `toBe(502)`, body, `health.status toBe(200)` | PASS |
| C30 | `instances: []` at the route -> 200, [] and null | e2e `model without profiles returns 200` ✓ | `print-profiles.e2e-spec.ts:150-153` - `toBe(200)`, `toEqual([])`, `toBeNull()` | PASS |
| C31 | 400/404/502 -> BadRequest/NotFound/BadGateway, same message | controller spec `maps domain errors to http` ✓ | `print-profiles.controller.spec.ts:28-30` - `toBeInstanceOf(type)`, `getStatus() toBe(status)`, `message toBe(...)` | PASS |
| C32 | token -> HttpMakerWorldClient; AppModule imports the module | module spec `wires the http client` ✓ | `print-profiles.module.spec.ts:9` - `toBeInstanceOf(HttpMakerWorldClient)`; `print-profiles.module.spec.ts:13` - regex over `app.module.ts`. Assemblies read directly: `api/src/app.module.ts:21` lists `PrintProfilesModule`, `api/src/main.ts:6` creates `AppModule` | PASS |
| C33 | no typeorm import under print-profiles | `test -z "$(grep -rlE ...)"` exit 0 | `api/src/modules/print-profiles/print-profiles.module.ts:6-12` - module with no `TypeOrmModule`; the grep returns no file | PASS |
| C34 | form filled from the import, swatches colored | web `fills the form from the import` ✓ | `web/src/components/print-profile-import.test.tsx:64-68` - `"0"`, `"28"`, AMS `true`, `"X2D"`, `"0,4"`; `print-profile-import.test.tsx:71-82` - 2 rows, slot/type/color/grams, `backgroundColor toBe(rgb)` | PASS |
| C35 | "Importando…" + button disabled | web `shows importing` ✓ | `print-profile-import.test.tsx:90-93` - `getByText("Importando…")`, `disabled toBe(true)` | PASS |
| C36 | 3 labelled options, switch without refetch | web `switches profile without refetch` ✓ | `print-profile-import.test.tsx:104-117` - `toHaveLength(3)`, `"Sea star · 0 h 28 min · 9 g"`, `value toBe("3387944")`, `"21"`/`"24"`, 4 rows, `toHaveBeenCalledTimes(1)` | PASS |
| C37 | null fields blank and editable | web `null fields are blank and editable` ✓ | `print-profile-import.test.tsx:131-138` - `toBe("")` x2, then `"A1 mini"`, `"7,5"` | PASS |
| C38 | 502 message / API-down message, each with a blank form | web `error shows message and blank form` ✓ | `print-profile-import.test.tsx:145-146` - `findByText(UNAVAILABLE)`, `expectBlankForm()` (`:32-39`); `print-profile-import.test.tsx:154-155` - `"Não foi possível conectar à API"`, `expectBlankForm()`. Claim holds as written; see P2 | PASS |
| C39 | no profiles -> message + blank form | web `model without profiles` ✓ | `print-profile-import.test.tsx:163-168` - `findByText("Este modelo não tem perfis …")`, `expectBlankForm()`. See P2 | PASS |
| C40 | initial blank form, add x2, remove 1 | web `blank form and filament rows` ✓ | `print-profile-import.test.tsx:177-195` - `expectBlankForm()`, `not.toHaveBeenCalled()`, `toHaveLength(2)`, `toHaveLength(1)`, remaining `"PETG"` | PASS |
| C41 | nav link + formatPrintTime 4 cases | web `links to print profiles` ✓ + `rounds to the nearest minute` ✓ | `web/src/components/app-shell.test.tsx:31-32` - `getByRole("link", { name: "Importar do MakerWorld" })`, `href toBe("/print-profiles")`; `web/src/lib/format-print-time.test.ts:6-9` - the 4 literals | PASS |
| C42 | default baseUrl goes through `node:https` `get` with URL, headers, signal; never `node:http` | https spec `uses node:https for the default base url` ✓ | `api/src/modules/print-profiles/makerworld.client.https.spec.ts:36-37` - `httpCalls toHaveLength(0)`, `httpsCalls toHaveLength(1)`; `makerworld.client.https.spec.ts:39-44` - `url.href toBe('https://makerworld.com/api/v1/design-service/design/3007827')`, `toMatchObject({ accept: 'application/json' })`, `toMatch(/^Brios3DForge\//)`, `signal toBeInstanceOf(AbortSignal)` | PASS |
| C43 | 90 -> 0 h 2 min, 3569 -> 0 h 59 min, 3570 -> 1 h 0 min | web `rounds half a minute up` ✓ | `web/src/lib/format-print-time.test.ts:13-15` - the 3 literals | PASS |
| C44 | url > 2048 chars -> 400 from ValidationPipe, client not called | e2e `url longer than 2048 characters returns 400` ✓ | `print-profiles.e2e-spec.ts:157` - URL of 2087 chars; `print-profiles.e2e-spec.ts:159-162` - `toBe(400)`, `toContain('url')`, `not.toContain('URL inválida')`, `calls toEqual([])`. Claim holds as written; see P3 | PASS |
| C45 | `user@`, `user:pass@`, `/models/0` -> 400 + C2 message | url spec `rejects userinfo and non positive design ids` ✓ | `makerworld-url.spec.ts:69-71` - the 3 URLs; `makerworld-url.spec.ts:74-75` - `toBe(400)`, `toBe(INVALID_URL)` | PASS |
| C46 | defaultInstanceId missing or `123` -> first profile 3387944 | mapper spec `falls back to the first profile` ✓ | `makerworld-design.mapper.spec.ts:287-289` - the two variants; `makerworld-design.mapper.spec.ts:291` - `selectedProfileId toBe(3387944)` | PASS |

Precision gaps. These are findings about the checks, not the code:

- **P1 (C11 and the "campos escalares" row).** C11 removes `usedG`, `usedM`, `type` and `color`
  only from the Sea star's single plate. That exercises `bySlot.set` and never `sumOrNull`, so it
  cannot tell null propagation apart from treating a missing value as zero across plates (G3). AC 9
  applied to a multi-plate profile, for example 3377800 with one plate's `usedG` removed, is never
  claimed.
- **P2 (C38, C39).** "o formulário com todos os campos vazios" is asserted only on a component that
  never held data, so it cannot tell a reset apart from no reset (G7, G9). The claim needs a
  successful import first.
- **P3 (C44).** The bound is claimed from above only. A check that a valid URL near the bound (or
  at least well over 100 chars) still imports is missing (G1).
- **P4 (door 1).** The literal shape says `id`, `slot` and `index` are never null, but no check
  claims what happens to an instance without `id`, a filament without a valid slot, or a plate
  without `index` (G4–G6).

Notes:

- C42 mocks `node:https` inside its own file (`makerworld.client.https.spec.ts:9-28`). It makes no
  network call: the mocked `get` emits an error. `node:http` is replaced with a throwing `get`, so a
  regression to `httpGet` is caught directly (F9 died at `:36`).
- The 5 MB `content-length` pre-check (`makerworld.client.ts:120-124`) is never exercised. The C21
  "too large" case streams a chunked body, so it takes the counting path at `:127-133`. Removing
  the pre-check does not change any claimed behaviour, because the streamed limit still refuses.
  This is recorded as a note, not a gap.
- Swept re-read: the only existing constraint the flow relies on is the global `ValidationPipe`
  with `whitelist` and `forbidNonWhitelisted`, and it is present at `api/src/app.setup.ts:9-13`.
  AD-011 is recorded in `.specs/STATE.md:17`, with AD-009 marked superseded at `:15`. The `n/a`
  rows are approved policy.

## Coverage

Recomputed at `19ce72b` from the authority over each set. Where the code must satisfy a set, the
authority is the plan's `Surface`, `Landing` and `Criteria`. Where the code is where the set is
discovered, the authority is the code's own branches. Each member was then looked up in a proof,
and the ones in doubt were confirmed by mutation.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| route statuses (4) | plan `Surface` | 200 C24, C30 · 400 C26, C27, C28, C44 · 404 C29 · 502 C29 | - |
| accepted URLs (7) | plan AC 8 | all 7 in C1 (`makerworld-url.spec.ts:23-34`) | - |
| refused URLs, plan AC 13 (8) | plan AC 13 | all 8 in C2 (`makerworld-url.spec.ts:42-49`) | - |
| refusal branches of `parseMakerWorldUrl` (code, 9) | `makerworld-url.ts:15-33` | parse failure C2 · scheme C2 · host C2 · port C2 · `username` C45 · `password` with empty username (`:25`) none · path C2 · unsafe integer (`:31` `isSafeInteger`) none · `designId <= 0` C45 | password-only userinfo (G2 survived); unsafe-integer id |
| profile fragment (3) | `makerworld-url.ts:35-39` | valid C1 · malformed C3 · absent C1, C8 | - |
| request body refusals (4) | `ImportPrintProfileDto` + `app.setup.ts:9-13` | missing C27 · not text C27 · extra key C27 · > 2048 C44 | - |
| `url` length bound (2 sides) | `dto/import-print-profile.dto.ts:5` + AC 8 | over 2048 refused C44 · long valid URL (> 88 chars, ≤ 2048) accepted none | accepted side (G1 survived) |
| nullable scalars (19) | door 1 + `print-profiles.types.ts` | 19 members table-driven in C11 (`mapper.spec.ts:141-177`) | - |
| door 1 never-null identifiers (3) | plan `Landing` door 1 ("`id`, `slot` e `index` nunca") | instance without valid `id` dropped (`mapper.ts:26`) none · filament without valid slot dropped (`mapper.ts:110`) none · plate without `index` gets its position (`mapper.ts:102`) none | id (G4), slot (G5), index (G6) |
| plate sum with a missing value (code + AC 9, 2) | `sumOrNull` `mapper.ts:151-153` | both present -> sum C7 · either `null` -> `null` none | null propagation (G3 survived) |
| invalid numbers (4) | AC 10, `toNonNegative` `mapper.ts:174-182` | `"abc"`, negative, `""`, `"2.66"` in C12 | - |
| format normalization (4) | door 1, `mapper.ts:184-206` | color, rate, layer height, wall loops in C13 | - |
| filament origin (2) | `mapper.ts:92-95` | plates C5, C7 · instanceFilaments C14 | - |
| profile selection (5 branches) | `selectProfile` `mapper.ts:46-66` | given + existing C4 · given + unknown C16, C28 · absent -> default C8 · absent, default missing/unknown -> first C46 · no profiles -> null C15 | - |
| fixture profiles (3) | fixture `instances[]` | 3387944 C4, C5 · 3377800 C7 · 3388305 C10 | - |
| unrecognized response (4) | AC 17, `mapper.ts:19-22` | `[]`, `null`, `"texto"`, `{}` in C17 | - |
| upstream failures (7) | AC 17 + `makerworld.client.ts:65-76,100-137` | timeout C21, C23 · 500 · 403 · 301 · too large (streamed) · invalid json · network - all C21, each logged C22 | - |
| domain -> HTTP (3) | `print-profiles.controller.ts:35-43` | 400, 404, 502 in C31; at the route C26/C28, C29 | - |
| screen states (5) | plan `Observable` + AC 21–28 | idle C40 · loading C35 · loaded C34 · error C38 · empty C39 | - |
| form reset when leaving `loaded` (2) | AC 25, AC 26 ("formulário em branco") + `print-profile-import.tsx:101,110` | loaded -> error none · loaded -> empty none | both (G7, G9 survived) |
| filament row actions (2) | AC 27 | add C40 · remove C40 | - |
| time formatting (5 cases) | assumption "Tempo na tela" | 1707, 77054, 89 C41 · round down 29 C41, 3569 C43 · half up 90, 3570 C43 | - |
| one-way doors (4) | plan `Landing` at HEAD | 1 contract C24, C13 (never-null ids: see row above) · 2 source/interface C18, C32 · 3 redirect/timeout/size/host/designId C18, C19, C21, C23, C25 · 4 `node:https` C42 | - |
| startup config (2) | assemblies read directly | `main.ts:6` -> `AppModule` -> `app.module.ts:21` (C32 regex) · token -> `HttpMakerWorldClient` `print-profiles.module.ts:10` (C32) | - |

## Test policy rows

Verified at `19ce72b`.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached through the route | `makerworld-url.ts`, `makerworld-design.mapper.ts` | route C24–C30, C44 · own layer C1–C17, C45, C46 | no - gap: the decision rows password-only userinfo (`url.ts:25`), unsafe integer (`url.ts:31`), plate-sum null propagation (`mapper.ts:151-153`) and the three door-1 identifier guards (`mapper.ts:26,102,110`) have no case |
| Decides, outside the route (HTTP client) | `makerworld.client.ts` | own layer against a local server C18–C23 + https transport C42 | yes - happy path, 404 and all 7 failures are members; the https branch is proven (F9 killed) |
| Input that does not decide (controller) | `print-profiles.controller.ts`, `dto/import-print-profile.dto.ts` | route C24, C26–C30, C44 (+ C31 own layer) | yes - accepted input, each of the 4 refusals, each error. The one-sided bound is recorded under P3 and G1 |
| Screen component | `print-profile-import.tsx`, `app-shell.tsx`, `format-print-time.ts` | Testing Library C34–C41, C43 | no - gap: the error and empty states are proven only from a blank form, so the reset that makes them blank is unproven (G7, G9) |

## Faults injected

Isolation: `git worktree add --detach <scratchpad>/wt HEAD` at `19ce72b`. `api/node_modules` and
`.env` were symlinked, and `web/node_modules` was APFS-cloned (Turbopack refuses a symlink). The
real tree's porcelain (`?? .playwright-mcp/`) was recorded first. Each mutant was an exact
single-occurrence replacement: its covering proof was run, then it was reverted with
`git checkout -- <file>`, with a clean porcelain check in the worktree after each one. After
`git worktree remove`, the real tree's porcelain matched the baseline.

The five-fault cap in `verify.md` was deliberately exceeded, as in round 1. The orchestrator
required re-injecting F9, F6 and F10, at least one fault per assertion surface (10 proof files), and
a hunt for new gaps. Rows F9–M9 run the narrowest covering proof. Rows G1–G9 are gap probes, and
each ran against the **whole** covering suite (API unit, e2e or web), so a survivor there survived
everything.

| Mutation | Location | Killed |
| --- | --- | --- |
| F9 (round-1 survivor) https branch uses `httpGet` | `api/src/modules/print-profiles/makerworld.client.ts:86` | yes - C42 (`expected [ … ] to have a length of +0 but got 1`) |
| F6 (round-1 survivor) `Math.round` -> `Math.floor` | `web/src/lib/format-print-time.ts:8` | yes - C43 (`expected '0 h 1 min' to be '0 h 2 min'`) |
| F10 (round-1 survivor) drop `@MaxLength(2048)` | `api/src/modules/print-profiles/dto/import-print-profile.dto.ts:5` | yes - C44 (`expected 200 to be 400`) |
| M1 `designId <= 0` -> `designId < 0` | `api/src/modules/print-profiles/makerworld-url.ts:31` | yes - C45 |
| M2 drop the `url.username` clause | `api/src/modules/print-profiles/makerworld-url.ts:24` | yes - C45 |
| M3 first-profile fallback -> last profile | `api/src/modules/print-profiles/makerworld-design.mapper.ts:65` | yes - C46 (`expected 3377800 to be 3387944`) |
| M4 swap `timeout` / `network` log reasons | `api/src/modules/print-profiles/makerworld.client.ts:72-74` | yes - C22 |
| M5 404 -> `BadGatewayException` | `api/src/modules/print-profiles/print-profiles.controller.ts:40` | yes - C31 |
| M6 token wired to a non-HTTP client | `api/src/modules/print-profiles/print-profiles.module.ts:10` | yes - C32 |
| M7 drop `@HttpCode(200)` | `api/src/modules/print-profiles/print-profiles.controller.ts:22` | yes - C24 (`expected 201 to be 200`) |
| M8 "Importando…" never rendered | `web/src/components/print-profile-import.tsx:165` | yes - C35 |
| M9 nav link text `Importar do MakerWorld` -> `Importar` | `web/src/components/app-shell.tsx:21` | yes - C41 |
| G1 `@MaxLength(2048)` -> `@MaxLength(100)` | `api/src/modules/print-profiles/dto/import-print-profile.dto.ts:5` | no - survived the whole `print-profiles.e2e-spec.ts` file (8/8) |
| G2 drop the `url.password` clause | `api/src/modules/print-profiles/makerworld-url.ts:25` | no - survived the whole API unit suite (75/75) |
| G3 `sumOrNull` -> `(a ?? 0) + (b ?? 0)` | `api/src/modules/print-profiles/makerworld-design.mapper.ts:152` | no - survived the whole API unit + e2e suites |
| G4 keep instances without a valid `id` | `api/src/modules/print-profiles/makerworld-design.mapper.ts:26` | no - survived the whole API unit + e2e suites |
| G5 keep filaments without a valid slot as `slot: 0` | `api/src/modules/print-profiles/makerworld-design.mapper.ts:110` | no - survived the whole API unit suite (75/75) |
| G6 drop the plate `index` fallback | `api/src/modules/print-profiles/makerworld-design.mapper.ts:102` | no - survived the whole API unit suite (75/75) |
| G7 error path no longer resets the form | `web/src/components/print-profile-import.tsx:110` | no - survived the whole web suite (20/20) |
| G9 no-profiles path no longer resets the form | `web/src/components/print-profile-import.tsx:101` | no - survived the whole web suite (20/20) |

## Gate

Run in the scratch worktree at `19ce72b`, clean:

- `npm --prefix api run test`: 75 passed, 0 failed (15 files)
- `npm --prefix api run test:e2e`: 29 passed, 0 failed (5 files)
- `npm --prefix web run test`: 20 passed, 0 failed (5 files)
- `npm --prefix api run lint` and `npm --prefix web run lint`: clean
- `npm --prefix api run build` and `npm --prefix web run build`: exit 0, and `/print-profiles` is
  prerendered

## Ranked gaps

1. Plate-sum null propagation unproven (AC 9, pricing correctness) - P1, G3 -
   `api/src/modules/print-profiles/makerworld-design.mapper.ts:151-153`. It needs a case on profile
   3377800 with one plate's `usedG` removed, expecting that slot's profile `grams` to be `null`.
2. Form reset on error / empty after a successful import unproven (AC 25, AC 26) - P2, G7, G9 -
   `web/src/components/print-profile-import.tsx:101,110`. C38/C39 need a successful import before the
   failing one.
3. Door 1 never-null `id` / `slot` / `index` unproven - P4, G4, G5, G6 -
   `api/src/modules/print-profiles/makerworld-design.mapper.ts:26,102,110`.
4. Accepted side of the 2048 bound unproven (AC 8) - P3, G1 -
   `api/src/modules/print-profiles/dto/import-print-profile.dto.ts:5`. It needs a valid URL of
   ~2048 chars that imports with 200.
5. (low) Password-only userinfo and unsafe-integer design id have no case - G2 -
   `api/src/modules/print-profiles/makerworld-url.ts:25,31`.

## Lessons

The Verifier was told to change nothing outside this report, so `scripts/lessons.py` was not run.
It writes `.specs/lessons.json` and `.specs/LESSONS.md`. Proposed lessons for the orchestrator:

- An aggregation that propagates `null` needs a missing-value case on a multi-item input. Removing
  a field where the aggregate has one item never reaches the combining branch.
- A "resets to blank" screen claim has to start from a filled state. Asserting blank on a component
  that was never filled proves nothing about the reset.
- A length bound needs both sides: over the bound refused, and a realistic long valid input
  accepted.
