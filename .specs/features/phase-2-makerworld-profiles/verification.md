# Fase 2 — Dados de impressão pela URL do MakerWorld verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 5df0c52..6354794
**Round**: 3 - full. Every proof was re-run, every assertion surface was re-injected and coverage was recomputed at `6354794`. The round-2 fix (`19ce72b..6354794`) touches only tests, `checks.md` and the report. No source file changed since `19ce72b`
**Verifier**: independent sub-agent (author != verifier)

Earlier rounds (in git history):

- Round 1 at `6f4a6ed`: FAIL. C1–C41 were proven, and F9 (https transport), F6 (`Math.floor`) and F10 (no `@MaxLength`) survived.
- Round 2 at `19ce72b`: FAIL. C1–C46 were proven and F9, F6 and F10 were killed, but probes G1–G7 and G9 survived (2048 accept side, password-only userinfo, `sumOrNull`, the door-1 identifier guards and the form reset).

All 51 checks are green at `6354794`, and each has a located assertion. Every round-2 survivor was
re-injected and **all 8 now die**: G1 by C50, G2 by C49, G3 by C47, G4/G5/G6 by C48 and G7/G9 by
C51. The round-1 mutants F9, F6 and F10 also still die, and so do the unsafe-integer probe and one
fault on each of the other proof surfaces. The verdict is still FAIL, because new probes found two
mapper behaviours that the contract and AC 2 depend on and that no test pins:

1. **The profile's filaments stay in slot order only because the fixture happens to be sorted
   (AC 2).** If the `.sort((a, b) => a.slot - b.slot)` is removed from `sumBySlot`
   (`makerworld-design.mapper.ts:148`), the whole API unit suite (78/78) and the e2e suite (30/30)
   still pass (H2). The mapper keeps slots in the order it first sees them. In every plate of the
   fixture that order happens to be `1, 2, 3, 4`. I ran the mutant on the fixture with slot 1
   removed from plate 1 of `3377800`, and it returned the profile's filaments as `[2, 3, 1, 4]`.
   A multi-plate model whose first plate does not use slot 1 is common, and the screen would
   list its filaments out of order. AC 2 says "nessa ordem de slot", and `Observable` says
   "filamentos por slot".
2. **The per-plate filaments of a multi-plate profile are not asserted (door 1).** `sumBySlot`
   copies the first filament it sees for each slot (`{ ...filament }`, `mapper.ts:140`) before it
   adds the later plates into it. If it stores the plate's own object instead, both whole API
   suites still pass (H16). I ran that mutant on the fixture: plate 1 of `3377800` reported
   `[[1,246],[2,64],[3,37]]` (the profile totals) instead of `[[1,19],[2,12],[3,7]]`. So
   `plates[].filaments` in the `PrintProfileImport` contract returned the wrong grams for every
   multi-plate profile. The web screen does not show plates, but Phases 12, 13 and 19 consume the
   contract. C5 asserts plate filaments only on the single-plate Sea star, and C7 asserts only the
   count, `index` and profile totals of the 11 plates.
3. **(low) The Coverage row "2049 caracteres recusado C44" is not what C44 sends.** The test
   (`print-profiles.e2e-spec.ts:157`) sends `?` + 2049 × `a`, which is a URL of 2087 characters.
   With the mutant `@MaxLength(2048)` -> `@MaxLength(2049)` (H4), both suites pass. The
   user-facing impact is nil. The count is there only because `checks.md` names this member
   itself, and that makes it a precision gap in the checks.

Two more probes survived. I do **not** count them, because no AC, check or door decides the
behaviour: `#profileId-0` accepted as profile `0` (H3), which then gets the "Perfil 0 não existe"
400 instead of being ignored, and dropping the cross-plate `type`/`color` fill in `sumBySlot` (H5).

## Binding sources

Step 1 runs only under `ui`, and this feature was approved under `standard`. The plan marks no
source as binding: `Sources` lists `ROADMAP.md` and the MakerWorld response of 2026-09-21 only as
provenance, so no comparison was owed. Verified at `6354794`.

## Checks

Verified at `6354794`. I ran these in the real tree, read-only:

- **API unit.** `npm --prefix api run test -- makerworld-url.spec.ts makerworld-design.mapper.spec.ts makerworld.client.spec.ts makerworld.client.https.spec.ts print-profiles.controller.spec.ts print-profiles.module.spec.ts -t "<31 names joined by |>" --reporter=verbose`
  exited 0 with 31 passed and 1 skipped (the non-proof `other errors are not converted`). Each of
  the 31 names is listed individually as ✓.
- **e2e.** `npm --prefix api run test:e2e -- test/print-profiles.e2e-spec.ts -t "<9 names>"` exited
  0 with 9/9 listed individually.
- **Web.** `npm --prefix web run test -- print-profile-import.test.tsx app-shell.test.tsx format-print-time.test.ts -t "<11 names>"`
  exited 0 with 11 passed and 1 skipped (the non-proof `renders header, nav and content`), each
  listed individually.
- **C33.** The shell proof exited 0.

The fix diff `19ce72b..6354794` only **appends** tests to the four touched spec files, so the
C1–C46 citations keep their lines. I spot-checked them at `6354794`. C47–C51 were added in
`6354794`, and every proof resolves to a test that was added in `5df0c52..6354794`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | 7 accepted URLs; ROADMAP URL -> profileId 3387944, the other 6 -> null | `accepts makerworld model urls` ✓ | `api/src/modules/print-profiles/makerworld-url.spec.ts:25` - `toEqual({ designId: 3007827, profileId: 3387944 })`; `makerworld-url.spec.ts:36` - `toEqual({ designId: 3007827, profileId: null })` over 6 URLs | PASS |
| C2 | 8 invalid inputs -> 400 + exact message | `rejects non makerworld urls` ✓ | `makerworld-url.spec.ts:53` - `error.status toBe(400)`; `makerworld-url.spec.ts:54` - `toBe(INVALID_URL)` | PASS |
| C3 | malformed fragment -> profileId null | `ignores malformed profile fragment` ✓ | `makerworld-url.spec.ts:60` - `toEqual({ designId: 3007827, profileId: null })` | PASS |
| C4 | Sea star scalars, printer, settings | `maps the sea star profile` ✓ | `makerworld-design.mapper.spec.ts:73` - `selectedProfileId toBe(3387944)`; `makerworld-design.mapper.spec.ts:75-80` - `'Sea star'`, `1707`, `9`, `true`, printer and settings literals | PASS |
| C5 | Sea star filaments by slot + single plate | `sea star filaments by slot` ✓ | `makerworld-design.mapper.spec.ts:85` - `toEqual(SEA_STAR_FILAMENTS)`; `makerworld-design.mapper.spec.ts:86-88` - plates literal | PASS |
| C6 | model and source | `maps model and source` ✓ | `makerworld-design.mapper.spec.ts:93` - `toEqual(MODEL)`; `makerworld-design.mapper.spec.ts:94-98` - source literal | PASS |
| C7 | 11 plates, 77054 s, 408 g, per-slot grams/colors, meters to 1e-9 | `sums plate filaments by slot` ✓ | `makerworld-design.mapper.spec.ts:103-114` - `toHaveLength(11)`, index `[1..11]`, `77054`, `408`, 4-slot literal; `makerworld-design.mapper.spec.ts:117` - `toBeLessThan(1e-9)`. The claim holds as written; see P6 and P7 | PASS |
| C8 | no profileId -> defaultInstanceId 3377800 | `defaults to the default instance` ✓ | `makerworld-design.mapper.spec.ts:122` - `toBe(3377800)` | PASS |
| C9 | profile order | `keeps profile order` ✓ | `makerworld-design.mapper.spec.ts:127` - `toEqual([3387944, 3388305, 3377800])` | PASS |
| C10 | Sea shell needsAms false | `needs ams false` ✓ | `makerworld-design.mapper.spec.ts:131` - `needsAms toBe(false)` | PASS |
| C11 | each of 19 scalars removed -> null, rest unchanged | `missing field becomes null` ✓ | `makerworld-design.mapper.spec.ts:177` - `toHaveLength(19)`; `makerworld-design.mapper.spec.ts:202-203` - `toEqual(expectedModel)` / `toEqual(expectedProfile)` | PASS |
| C12 | invalid numbers -> null; "2.66" -> number | `invalid numbers become null` ✓ | `makerworld-design.mapper.spec.ts:212-213` - `toBeNull()`; `makerworld-design.mapper.spec.ts:221-222` - `toBe(2.66)`, `typeof toBe('number')` | PASS |
| C13 | color, rate, layer height, wall loops | `normalizes color and rates` ✓ | `makerworld-design.mapper.spec.ts:231-243` - `'#FD8008'`, `toBeNull()` x2, `0.15`, `toBeNull()`, `0.2`, `2` | PASS |
| C14 | no plates -> instanceFilaments, sequential slots | `falls back to instance filaments` ✓ | `makerworld-design.mapper.spec.ts:250-254` - `plates toEqual([])`, slot 1/2 literal | PASS |
| C15 | `instances: []` / missing -> [] and null | `model without profiles` ✓ | `makerworld-design.mapper.spec.ts:264-265` - `toEqual([])`, `toBeNull()` | PASS |
| C16 | unknown profileId 999 -> 400 + message | `unknown profile id` ✓ | `makerworld-design.mapper.spec.ts:271-274` - `toBe(400)`, exact message literal | PASS |
| C17 | `[]`, `null`, `"texto"`, `{}` -> 502 + message | `unrecognized design is 502` ✓ | `makerworld-design.mapper.spec.ts:280-281` - `toBe(502)`, `toBe(UNAVAILABLE)` | PASS |
| C18 | one GET with accept + user-agent; returns JSON | `requests the design endpoint` ✓ | `makerworld.client.spec.ts:104-110` - `resolves.toEqual(...)`, `toHaveLength(1)`, url, accept, `` toBe(`Brios3DForge/${VERSION}`) `` | PASS |
| C19 | default baseUrl, timeout, maxBytes | `default limits` ✓ | `makerworld.client.spec.ts:117-121` - `toEqual({ baseUrl: 'https://makerworld.com', timeoutMs: 10000, maxBytes: 5242880 })` | PASS |
| C20 | upstream 404 -> 404 + message | `upstream 404` ✓ | `makerworld.client.spec.ts:132-133` - `toBe(404)`, exact message | PASS |
| C21 | 7 upstream failures -> 502; the redirect makes one request | `upstream failures are 502` ✓ | `makerworld.client.spec.ts:140` - `toHaveLength(7)`; `makerworld.client.spec.ts:153-156` - `toBe(502)`, `toBe(UNAVAILABLE)`, `requests toHaveLength(1)` | PASS |
| C22 | warn with designId + reason; message leaks no reason | `logs upstream failure` ✓ | `makerworld.client.spec.ts:181-186` - `toHaveBeenCalledTimes(1)`, `toContain('3007827')`, `toContain(failure.reason)`, `not.toContain(other.reason)` | PASS |
| C23 | timeout 200 ms rejects in < 2 s | `timeout aborts the request` ✓ | `makerworld.client.spec.ts:204-205` - `toBe(502)`, `toBeLessThan(2000)` | PASS |
| C24 | route 200 with full Sea star contract | e2e `imports the sea star profile` ✓ | `api/test/print-profiles.e2e-spec.ts:59` - `status toBe(200)`; `print-profiles.e2e-spec.ts:66-90` - source, model, `3387944`, `toHaveLength(3)`, full profile literal | PASS |
| C25 | fake client gets exactly one numeric designId | e2e `client receives only the design id` ✓ | `print-profiles.e2e-spec.ts:95-96` - `toEqual([3007827])`, `typeof toBe('number')` | PASS |
| C26 | printables URL -> 400 exact body; client not called | e2e `invalid url returns 400` ✓ | `print-profiles.e2e-spec.ts:101-105` - `toBe(400)`, exact body, `calls toEqual([])` | PASS |
| C27 | body validation 400s | e2e `body validation` ✓ | `print-profiles.e2e-spec.ts:110-119` - `toBe(400)` x3, `toContain('url')` x2, `toContain('should not exist')` | PASS |
| C28 | unknown profile -> 400 exact body | e2e `unknown profile returns 400` ✓ | `print-profiles.e2e-spec.ts:124-128` - `toBe(400)`, exact body | PASS |
| C29 | 404 / 502 exact bodies; /health 200 after | e2e `upstream errors` ✓ | `print-profiles.e2e-spec.ts:135-144` - `toBe(404)`, body, `toBe(502)`, body; `print-profiles.e2e-spec.ts:144` - `health.status toBe(200)` | PASS |
| C30 | `instances: []` at the route -> 200, [] and null | e2e `model without profiles returns 200` ✓ | `print-profiles.e2e-spec.ts:150-153` - `toBe(200)`, `toEqual([])`, `toBeNull()` | PASS |
| C31 | 400/404/502 -> BadRequest/NotFound/BadGateway | `maps domain errors to http` ✓ | `print-profiles.controller.spec.ts:28-30` - `toBeInstanceOf(type)`, `getStatus() toBe(status)`, `message toBe(...)` | PASS |
| C32 | token -> HttpMakerWorldClient; AppModule imports module | `wires the http client` ✓ | `print-profiles.module.spec.ts:9` - `toBeInstanceOf(HttpMakerWorldClient)`; `print-profiles.module.spec.ts:13` - regex over `app.module.ts`. I read the assemblies directly: `api/src/app.module.ts:21` lists the module and `api/src/main.ts:6` creates `AppModule` | PASS |
| C33 | no typeorm import under print-profiles | `test -z "$(grep -rlE ...)"` exit 0 | `api/src/modules/print-profiles/print-profiles.module.ts:6-12` - module without `TypeOrmModule`; the grep returns no file | PASS |
| C34 | form filled from the import, swatches colored | web `fills the form from the import` ✓ | `web/src/components/print-profile-import.test.tsx:64-68` - `"0"`, `"28"`, AMS, `"X2D"`, `"0,4"`; `print-profile-import.test.tsx:71-82` - 2 rows, values, `backgroundColor` | PASS |
| C35 | "Importando…" + button disabled | web `shows importing` ✓ | `print-profile-import.test.tsx:90-93` - `getByText("Importando…")`, `disabled toBe(true)` | PASS |
| C36 | 3 labelled options, switch without refetch | web `switches profile without refetch` ✓ | `print-profile-import.test.tsx:104-117` - `toHaveLength(3)`, `"Sea star · 0 h 28 min · 9 g"`, `"3387944"`, `"21"`/`"24"`, 4 rows, `toHaveBeenCalledTimes(1)` | PASS |
| C37 | null fields blank and editable | web `null fields are blank and editable` ✓ | `print-profile-import.test.tsx:131-138` - `toBe("")` x2, then `"A1 mini"`, `"7,5"` | PASS |
| C38 | 502 / API-down message with blank form | web `error shows message and blank form` ✓ | `print-profile-import.test.tsx:145-146` - `findByText(UNAVAILABLE)`, `expectBlankForm()` (`print-profile-import.test.tsx:32-39`); `print-profile-import.test.tsx:154-155` - `"Não foi possível conectar à API"`, `expectBlankForm()` | PASS |
| C39 | no profiles -> message + blank form | web `model without profiles` ✓ | `print-profile-import.test.tsx:163-168` - `findByText("Este modelo não tem perfis …")`, `expectBlankForm()` | PASS |
| C40 | initial blank form, add x2, remove 1 | web `blank form and filament rows` ✓ | `print-profile-import.test.tsx:177-195` - `expectBlankForm()`, `not.toHaveBeenCalled()`, `toHaveLength(2)`, `toHaveLength(1)` | PASS |
| C41 | nav link + formatPrintTime 4 cases | web `links to print profiles` ✓ + `rounds to the nearest minute` ✓ | `web/src/components/app-shell.test.tsx:31-32` - link by name, `href toBe("/print-profiles")`; `web/src/lib/format-print-time.test.ts:6-9` - the 4 literals | PASS |
| C42 | default baseUrl uses `node:https` `get`, never `node:http` | `uses node:https for the default base url` ✓ | `makerworld.client.https.spec.ts:36-37` - `httpCalls toHaveLength(0)`, `httpsCalls toHaveLength(1)`; `makerworld.client.https.spec.ts:39-44` - url href, accept, UA regex, `signal toBeInstanceOf(AbortSignal)` | PASS |
| C43 | 90 -> 0 h 2 min, 3569 -> 0 h 59 min, 3570 -> 1 h 0 min | `rounds half a minute up` ✓ | `web/src/lib/format-print-time.test.ts:13-15` - the 3 literals | PASS |
| C44 | url > 2048 chars -> 400 from ValidationPipe, client not called | e2e `url longer than 2048 characters returns 400` ✓ | `print-profiles.e2e-spec.ts:157` - URL of 2087 chars; `print-profiles.e2e-spec.ts:159-162` - `toBe(400)`, `toContain('url')`, `not.toContain('URL inválida')`, `calls toEqual([])`. The claim holds on the one length it samples; see P5 | PASS |
| C45 | `user@`, `user:pass@`, `/models/0` -> 400 + C2 message | `rejects userinfo and non positive design ids` ✓ | `makerworld-url.spec.ts:74-75` - `toBe(400)`, `toBe(INVALID_URL)` over the 3 URLs at `makerworld-url.spec.ts:69-71` | PASS |
| C46 | defaultInstanceId missing or `123` -> first profile | `falls back to the first profile` ✓ | `makerworld-design.mapper.spec.ts:291` - `selectedProfileId toBe(3387944)` | PASS |
| C47 | missing value in one plate -> slot total null; other slots 64/37/61 | `null in one plate makes the slot total null` ✓ | `makerworld-design.mapper.spec.ts:303-304` - `bySlot.get(1)?.grams toBeNull()`, `meters toBeNull()`; `makerworld-design.mapper.spec.ts:305-307` - `toBe(64)`, `toBe(37)`, `toBe(61)` | PASS |
| C48 | `id`/`slot`/`index` never null | `identifiers are never null` ✓ | `makerworld-design.mapper.spec.ts:323` - ids `toEqual([3387944, 3388305, 3377800])`; `makerworld-design.mapper.spec.ts:325-327` - index `[1]`, plate slots `[1, 4]`, profile slots `[1, 4]`; `makerworld-design.mapper.spec.ts:332` - `plates[1].index toBe(2)` | PASS |
| C49 | `https://:pass@…` and a 20-digit id -> 400 + C2 message | `rejects password only userinfo and unsafe design ids` ✓ | `makerworld-url.spec.ts:85-86` - `toBe(400)`, `toBe(INVALID_URL)` over the 2 URLs at `makerworld-url.spec.ts:81-82` | PASS |
| C50 | 2048-char valid URL -> 200, client gets 3007827 | e2e `url with exactly 2048 characters is accepted` ✓ | `print-profiles.e2e-spec.ts:168` - `toHaveLength(2048)`; `print-profiles.e2e-spec.ts:170-171` - `toBe(200)`, `calls toEqual([3007827])` | PASS |
| C51 | success then 502 / empty -> message, no selector, blank form | web `a failed or empty import after a success clears the form` ✓ | `print-profile-import.test.tsx:223` - `filamentRows() toHaveLength(2)` (precondition); `print-profile-import.test.tsx:226-228` - `findByText(message)`, `queryByRole("combobox") toBeNull()`, `expectBlankForm()` | PASS |

Precision gaps. These are findings about the checks, not about the code:

- **P5 (C44 and the "tamanho do corpo `url`" Coverage row).** The row names "2049 caracteres
  recusado C44", but the proof sends 2087 characters (`print-profiles.e2e-spec.ts:157`), so the
  upper bound is pinned only to within 39 characters (H4). Low severity: no AC fixes the value
  2048.
- **P6 (AC 2 and C5/C7).** "nessa ordem de slot" is claimed only on inputs whose slots already
  appear in ascending order, so the claim cannot tell a sort apart from no sort (H2). It needs a
  case where the first plate does not use slot 1, or where a plate lists `4` before `1`.
- **P7 (door 1 `plates[].filaments`).** Per-plate filament values are claimed only on the
  single-plate Sea star (C5, C24). No check claims a plate's own grams on a multi-plate profile,
  for example plate 1 of `3377800` = slot 1 `19` g, slot 2 `12` g and slot 3 `7` g, so the
  accumulator can leak into a plate (H16).

Notes:

- These are carried from `19ce72b` and re-read at `6354794`. The 5 MB `content-length`
  pre-check (`makerworld.client.ts:120-124`) is never exercised, because the C21 "too large" case
  is chunked. Removing the pre-check is equivalent for every claim, because the streamed count at
  `makerworld.client.ts:127-133` still refuses.
- Swept re-read: the global `ValidationPipe` with `whitelist` and `forbidNonWhitelisted` is still
  at `api/src/app.setup.ts:9-13`. AD-011 is in `.specs/STATE.md`, and it supersedes AD-009. The
  `n/a` rows are approved policy.

## Coverage

I recomputed each set at `6354794` from its authority. For sets the code must satisfy, the
authority is the plan's `Surface`, `Landing`, `Criteria` and `Observable`. For sets the code
discovers, it is the code's own branches. Members in doubt were settled by mutation.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| route statuses (4) | plan `Surface` | 200 C24, C30, C50 · 400 C26, C27, C28, C44 · 404 C29 · 502 C29 | - |
| accepted URLs (7) | plan AC 8 | all 7 in C1 (`makerworld-url.spec.ts:23-34`) | - |
| refused URLs, plan AC 13 (8) | plan AC 13 | all 8 in C2 (`makerworld-url.spec.ts:42-49`) | - |
| refusal branches of `parseMakerWorldUrl` (code, 9) | `makerworld-url.ts:15-33` | parse C2 · scheme C2 · host C2 · port C2 · username C45 · password C49 · path C2 · unsafe integer C49 · `<= 0` C45 | - |
| profile fragment (3 forms) | `makerworld-url.ts:35-39`, AC 5 | valid C1 · malformed C3 · absent C1, C8. `#profileId-0` is decided by the code but by no AC (H3, not counted) | - |
| request body refusals (4) | DTO + `app.setup.ts:9-13` | missing C27 · not text C27 · extra key C27 · over the bound C44 | - |
| `url` length bound (2 sides) | `dto/import-print-profile.dto.ts:5` + `checks.md` row | 2048 accepted C50 · 2049 refused: the row names C44, but C44 sends 2087 | 2049 exactly (H4 survived; P5) |
| nullable scalars (19) | door 1 + `print-profiles.types.ts` | table-driven in C11 | - |
| door 1 non-null identifiers (3) | plan `Landing` door 1 | `id` C48 · `slot` C48 · `index` C48 | - |
| door 1 `plates[].filaments` per plate (2 shapes) | plan `Landing` door 1 + AC 4 | single plate C5, C24 · multi-plate profile, per-plate values none | multi-plate per-plate values (H16 survived; P7) |
| plate sum with a missing value (2) | `sumOrNull` `mapper.ts:151-153`, AC 9 | both present C7 · one `null` -> `null` C47 | - |
| profile filament order (2) | AC 2 "nessa ordem de slot", `Observable` ordering, `mapper.ts:148` | slots first seen in ascending order C5, C7 · slots first seen out of order none | out-of-order input (H2 survived; P6) |
| invalid numbers (4) | AC 10 | all in C12 | - |
| format normalization (4) | door 1 | all in C13 | - |
| filament origin (2) | `mapper.ts:92-95` | plates C5, C7 · instanceFilaments C14 | - |
| profile selection (5 branches) | `selectProfile` `mapper.ts:46-66` | given C4 · unknown C16, C28 · default C8 · first C46 · none C15 | - |
| fixture profiles (3) | fixture `instances[]` | 3387944 C4 · 3377800 C7 · 3388305 C10 | - |
| unrecognized response (4) | AC 17 | all in C17 | - |
| upstream failures (7) | AC 17 + `makerworld.client.ts` | table-driven in C21, logged C22, timeout C23 | - |
| domain -> HTTP (3) | `print-profiles.controller.ts:35-43` | C31; at the route C26, C28, C29 | - |
| screen states (5) | plan `Observable` + AC 21–28 | idle C40 · loading C35 · loaded C34 · error C38 · empty C39 | - |
| form reset when leaving `loaded` (2) | AC 25, AC 26 | loaded -> error C51 · loaded -> empty C51 | - |
| filament row actions (2) | AC 27 | add C40 · remove C40 | - |
| time formatting (5 cases) | assumption "Tempo na tela" | C41, C43 | - |
| one-way doors (4) | plan `Landing` | 1 C24, C13, C48 (per-plate values: row above) · 2 C18, C32 · 3 C18, C19, C21, C23, C25 · 4 C42 | - |
| startup config (2) | assemblies read directly | `main.ts:6` -> `AppModule` -> `app.module.ts:21` (C32) · token -> `HttpMakerWorldClient` `print-profiles.module.ts:10` (C32) | - |

## Test policy rows

Verified at `6354794`.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached through the route | `makerworld-url.ts`, `makerworld-design.mapper.ts` | route C24–C30, C44, C50 · own layer C1–C17, C45–C49 | no - gap: two mapper decision rows have no case, the slot sort (`mapper.ts:148`, H2) and the per-plate copy in `sumBySlot` (`mapper.ts:140`, H16). The round-2 rows (`url.ts:25,31`, `mapper.ts:26,102,110,151-153`) are now proven |
| Decides, outside the route (HTTP client) | `makerworld.client.ts` | own layer against a local server C18–C23 + https C42 | yes - happy path, 404 and all 7 failures, and the https branch is proven (F9 killed) |
| Input that does not decide (controller) | `print-profiles.controller.ts`, `dto/import-print-profile.dto.ts` | route C24, C26–C30, C44, C50 (+ C31 own layer) | yes - the accepted input, each of the 4 refusal kinds and each error. The exact upper bound is recorded under P5 and H4 |
| Screen component | `print-profile-import.tsx`, `app-shell.tsx`, `format-print-time.ts` | Testing Library C34–C41, C43, C51 | yes - every screen state, and the reset from `loaded` (G7 and G9 killed) |

## Faults injected

Isolation: I ran `git worktree add --detach <scratchpad>/wt3 HEAD` at `6354794`, symlinked
`api/node_modules` and `.env`, and APFS-cloned `web/node_modules`. The real tree's porcelain
(`?? .playwright-mcp/`) was recorded first. Each mutant was an exact single-occurrence
replacement. I ran its covering proof, then reverted it with `git checkout -- <file>`, and checked
that the worktree's porcelain was clean after each one. After `git worktree remove`, the real
tree's porcelain matched the baseline and `git worktree list` showed only the main tree.

The five-fault cap was deliberately exceeded because the orchestrator asked for three things:
every round-1 and round-2 survivor re-injected, at least one fault per assertion surface (11 proof
surfaces), and new probes. Re-injections and surface faults ran the narrowest covering spec file.
The H probes ran the **whole** API unit suite and the whole e2e suite, so a survivor there
survived everything.

| Mutation | Location | Killed |
| --- | --- | --- |
| F9 (round 1) https branch uses `httpGet` | `api/src/modules/print-profiles/makerworld.client.ts:86` | yes - C42 (`expected [ … ] to have a length of +0 but got 1`) |
| F6 (round 1) `Math.round` -> `Math.floor` | `web/src/lib/format-print-time.ts:8` | yes - C43 (`expected '0 h 1 min' to be '0 h 2 min'`) |
| F10 (round 1) drop `@MaxLength(2048)` | `api/src/modules/print-profiles/dto/import-print-profile.dto.ts:5` | yes - C44 (`expected 200 to be 400`) |
| G1 (round 2) `@MaxLength(2048)` -> `@MaxLength(100)` | `api/src/modules/print-profiles/dto/import-print-profile.dto.ts:5` | yes - C50 (`expected 400 to be 200`) |
| G2 (round 2) drop the `url.password` clause | `api/src/modules/print-profiles/makerworld-url.ts:25` | yes - C49 (`expected PrintProfileError`) |
| H1 (round-2 extra) `isSafeInteger(designId)` -> `isFinite` | `api/src/modules/print-profiles/makerworld-url.ts:31` | yes - C49 |
| G3 (round 2) `sumOrNull` -> `(a ?? 0) + (b ?? 0)` | `api/src/modules/print-profiles/makerworld-design.mapper.ts:152` | yes - C47 (`expected 239 to be null`) |
| G4 (round 2) keep instances without a valid `id` | `api/src/modules/print-profiles/makerworld-design.mapper.ts:26` | yes - C48 (5 ids instead of 3) |
| G5 (round 2) invalid slot emitted as `0` | `api/src/modules/print-profiles/makerworld-design.mapper.ts:110` | yes - C48 (`[ 1, 4, +0, +0, +0 ]`) |
| G6 (round 2) drop the plate `index` fallback | `api/src/modules/print-profiles/makerworld-design.mapper.ts:102` | yes - C48 (`[ undefined ]` vs `[ 1 ]`) |
| G7 (round 2) error path keeps the old form | `web/src/components/print-profile-import.tsx:110` | yes - C51 (`expected '0' to be ''`) |
| G9 (round 2) no-profiles path keeps the old form | `web/src/components/print-profile-import.tsx:101` | yes - C51 (`expected '0' to be ''`) |
| M4 3xx logged as `status 301`, not `redirect` | `api/src/modules/print-profiles/makerworld.client.ts:115` | yes - C22 |
| M5 404 -> `BadGatewayException` | `api/src/modules/print-profiles/print-profiles.controller.ts:40` | yes - C31 |
| M6 client token wired to a stub value | `api/src/modules/print-profiles/print-profiles.module.ts:10` | yes - C32 |
| M9 nav link `href` -> `/print-profile` | `web/src/components/app-shell.tsx:18` | yes - C41 |
| M10 `typeorm` import added to the service | `api/src/modules/print-profiles/print-profiles.service.ts:1` | yes - C33 (shell proof exit 1) |
| H2 drop the slot sort in `sumBySlot` | `api/src/modules/print-profiles/makerworld-design.mapper.ts:148` | no - survived the whole API unit (78/78) and e2e (30/30) suites. On the fixture with slot 1 removed from plate 1 of `3377800`, the profile's filaments came back as `[2, 3, 1, 4]`, which breaks AC 2 |
| H16 store the plate's own filament object in `sumBySlot` (no copy) | `api/src/modules/print-profiles/makerworld-design.mapper.ts:140` | no - survived both whole suites. Plate 1 of `3377800` reported `[[1,246],[2,64],[3,37]]` instead of `[[1,19],[2,12],[3,7]]`, which corrupts door 1 `plates[].filaments` |
| H4 `@MaxLength(2048)` -> `@MaxLength(2049)` | `api/src/modules/print-profiles/dto/import-print-profile.dto.ts:5` | no - survived both whole suites. Low severity: it contradicts the Coverage member "2049 recusado", but no AC fixes the bound |
| H3 fragment `profileId > 0` dropped (`#profileId-0` -> profile `0`) | `api/src/modules/print-profiles/makerworld-url.ts:39` | survived both whole suites, but no requirement decides this. It is not equivalent: `#profileId-0` gets the "Perfil 0 não existe" 400 instead of being ignored. No AC, check or door covers a zero fragment, so it is not counted |
| H5 drop the cross-plate `type`/`color` fill (`??=`) | `api/src/modules/print-profiles/makerworld-design.mapper.ts:143-144` | survived both whole suites, but no requirement decides this. It changes output only when a slot's first plate lacks `type` or `color` and a later plate has it. AC 9 accepts `null` there, so it is not counted |

## Gate

Run once in the scratch worktree at `6354794`, on a clean tree:

- `npm --prefix api run lint`: exit 0
- `npm --prefix api run test`: 78 passed, 0 failed (15 files)
- `npm --prefix api run test:e2e`: 30 passed, 0 failed (5 files)
- `npm --prefix api run build`: exit 0
- `npm --prefix web run lint`: exit 0
- `npm --prefix web run test`: 21 passed, 0 failed (5 files)
- `npm --prefix web run build`: exit 0, with `/print-profiles` prerendered

## Ranked gaps

1. Per-plate filaments of a multi-plate profile are unasserted, so the `sumBySlot` accumulator can
   leak into `plates[].filaments` (door 1). This is P7 and H16, at
   `api/src/modules/print-profiles/makerworld-design.mapper.ts:140`. It needs an assertion that
   plate 1 of `3377800` keeps slot 1 `19` g, slot 2 `12` g and slot 3 `7` g, with the meters of
   the same plate.
2. The slot order of the profile's filaments is unproven for input that is not already in order
   (AC 2). This is P6 and H2, at `api/src/modules/print-profiles/makerworld-design.mapper.ts:148`.
   It needs a case where plate 1 of `3377800` lacks slot 1, or where a plate lists slot `4` before
   slot `1`, expecting slots `[1, 2, 3, 4]`.
3. (low) The Coverage member "2049 caracteres recusado" is sampled at 2087. This is P5 and H4, at
   `api/test/print-profiles.e2e-spec.ts:157`. Sending exactly 2049 characters closes it.

## Lessons

The Verifier was told to change nothing outside this report, so `scripts/lessons.py` was not run.
Proposed lessons for the orchestrator:

- An ordering claim needs input that arrives out of order. A fixture that is already sorted
  cannot tell a sort apart from no sort.
- When an aggregate is built by mutating the first item it sees, assert the source items after
  aggregating, not only the aggregate.
- A coverage row that names a boundary value must be proven at that value, not at some other
  value past it.
