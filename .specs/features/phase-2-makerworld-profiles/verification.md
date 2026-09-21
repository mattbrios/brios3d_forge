# Fase 2 — Dados de impressão pela URL do MakerWorld verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 5df0c52..4cb1a22
**Round**: 5 - full, authorised by the user. `verify.md` bounds verification at three rounds. The user explicitly authorised round 4 and then this fifth round. Every proof was re-run, the earlier survivors and one fault per assertion surface were re-injected, and coverage was recomputed at `4cb1a22`. The round-4 fix (`ad8a745..4cb1a22`) touches only `web/src/components/print-profile-import.test.tsx` (one test appended after line 230), `checks.md` and the report. `git diff --stat 6f4a6ed..HEAD` over non-test sources in `api/src` and `web/src` is empty, so no production source has changed since `6f4a6ed`
**Verifier**: independent sub-agent (author != verifier)

Earlier rounds (in git history):

- Round 1 at `6f4a6ed`: FAIL. C1–C41 were proven, and F9 (https transport), F6 (`Math.floor`) and F10 (no `@MaxLength`) survived.
- Round 2 at `19ce72b`: FAIL. C1–C46 were proven and the round-1 mutants were killed, but probes G1–G7 and G9 survived.
- Round 3 at `6354794`: FAIL. C1–C51 were proven and every earlier mutant was killed, but H2 (slot sort), H16 (per-plate copy) and H4 (2049 bound) survived.
- Round 4 at `ad8a745`: FAIL. C1–C54 were proven and every earlier mutant was killed, but I6 (screen opens on `profiles[0]`) survived. I1–I4 were recorded as notes.

All 55 checks are green at `4cb1a22`, and each has a located assertion. The round-4 survivor
now dies: I6 is killed by C55 (`expected '3387944' to be '3377800'`). The representative
earlier survivors were re-injected and all still die: F9, F6, G3, G7, H2, H16 and H4. One fault
on each of the other proof surfaces dies too (G2, M4, M5, M6, M9, M10 and I5).

The verdict is still FAIL because of one new gap. It changes behaviour that a user sees and that
AC 24 names:

1. **AC 24 ("campo que volta `null` aparece vazio e editável") is proven on 2 of the 8 nullable
   fields that the form shows.** C37 nulls only `printer.name` and `filaments[0].grams`. The
   other six are unguarded. Three probes on `web/src/components/print-profile-import.tsx` each
   survived the whole web suite (22/22):
   - N7: `needsAms: profile.needsAms ?? false` -> `?? true` (line 67). A profile whose AMS need
     is unknown opens with "Precisa de AMS" checked.
   - N8: `type: filament.type ?? ""` -> `?? "PLA"` (line 73). A filament with no type opens
     pre-filled with `PLA`.
   - N9: `hours: time ? … : ""` -> `: "0"` (line 65). A profile with no print time opens with
     `0` hours.

   In each case the form shows a value that MakerWorld never sent, and a user pricing from it
   would not notice. AC 24 is the criterion that forbids exactly this. The code is correct today,
   so the fix is test-only: a web case that nulls `printSeconds`, `needsAms`,
   `printer.nozzleDiameterMm` and a filament's `type`, `color` and `meters`, then asserts that each
   is `""` (or unchecked) and editable.

Six more probes survived (N1–N6). I do **not** count them, because no AC, check or door depends
on the behaviour they change, or they are equivalent under the door-1 contract. They are listed
under Faults injected. The `content-length` pre-check carried from round 2 is N3.

## Binding sources

Step 1 runs only under `ui`, and this feature was approved under `standard`. The plan marks no
source as binding: `Sources` lists `ROADMAP.md` and the MakerWorld response of 2026-09-21 only as
provenance, so no comparison was owed. Verified at `4cb1a22`.

## Checks

Verified at `4cb1a22`. I ran these in the real tree, read-only, in one invocation per target.
Each named test appears individually as ✓ in the verbose output:

- **API unit.** `npm --prefix api run test -- <the 6 print-profiles spec files> -t "<33 names joined by |>" --reporter=verbose`
  exited 0: 6 files passed, 33 passed and 1 skipped. The skipped test is `other errors are not
  converted`, which is not a proof.
- **e2e.** `npm --prefix api run test:e2e -- test/print-profiles.e2e-spec.ts -t "<10 names>" --reporter=verbose`
  exited 0 with 10/10 passed.
- **Web.** `npm --prefix web run test -- print-profile-import.test.tsx app-shell.test.tsx format-print-time.test.ts -t "<12 names>" --reporter=verbose`
  exited 0 with 12 passed and 1 skipped. The skipped test is `renders header, nav and content`,
  which is not a proof.
- **C33.** The shell proof exited 0.

I located every proof name with a single `grep` over `api/src`, `api/test` and `web/src`. Each
of the 55 proofs resolves to exactly one `it(` in a file the feature added in
`5df0c52..4cb1a22`. The API test files are unchanged since `ad8a745`, and the web test file only
gained lines 231–243, so the C1–C54 citations keep their lines. I spot-checked this against the
`it(` lines: `makerworld-url.spec.ts:20`, `mapper.spec.ts:101`, `e2e-spec.ts:57` and
`print-profile-import.test.tsx:198` are where round 4 put them.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | 7 accepted URLs; ROADMAP URL -> profileId 3387944, the other 6 -> null | `accepts makerworld model urls` ✓ | `api/src/modules/print-profiles/makerworld-url.spec.ts:25` - `toEqual({ designId: 3007827, profileId: 3387944 })`; `makerworld-url.spec.ts:36` - `toEqual({ designId: 3007827, profileId: null })` over 6 URLs | PASS |
| C2 | 8 invalid inputs -> 400 + exact message | `rejects non makerworld urls` ✓ | `makerworld-url.spec.ts:53` - `error.status toBe(400)`; `makerworld-url.spec.ts:54` - `toBe(INVALID_URL)` | PASS |
| C3 | malformed fragment -> profileId null | `ignores malformed profile fragment` ✓ | `makerworld-url.spec.ts:60` - `toEqual({ designId: 3007827, profileId: null })` | PASS |
| C4 | Sea star scalars, printer, settings | `maps the sea star profile` ✓ | `makerworld-design.mapper.spec.ts:73` - `selectedProfileId toBe(3387944)`; `makerworld-design.mapper.spec.ts:75-80` - `'Sea star'`, `1707`, `9`, `true`, printer and settings literals | PASS |
| C5 | Sea star filaments by slot + single plate | `sea star filaments by slot` ✓ | `makerworld-design.mapper.spec.ts:85` - `toEqual(SEA_STAR_FILAMENTS)`; `makerworld-design.mapper.spec.ts:86-88` - plates literal | PASS |
| C6 | model and source | `maps model and source` ✓ | `makerworld-design.mapper.spec.ts:93` - `toEqual(MODEL)`; `makerworld-design.mapper.spec.ts:94-98` - source literal | PASS |
| C7 | 11 plates, 77054 s, 408 g, per-slot grams/colors, meters to 1e-9 | `sums plate filaments by slot` ✓ | `makerworld-design.mapper.spec.ts:103-114` - `toHaveLength(11)`, index `[1..11]`, `77054`, `408`, 4-slot literal; `makerworld-design.mapper.spec.ts:117` - `toBeLessThan(1e-9)` | PASS |
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
| C29 | 404 / 502 exact bodies; /health 200 after | e2e `upstream errors` ✓ | `print-profiles.e2e-spec.ts:135-143` - `toBe(404)`, body, `toBe(502)`, body; `print-profiles.e2e-spec.ts:144` - `health.status toBe(200)` | PASS |
| C30 | `instances: []` at the route -> 200, [] and null | e2e `model without profiles returns 200` ✓ | `print-profiles.e2e-spec.ts:150-153` - `toBe(200)`, `toEqual([])`, `toBeNull()` | PASS |
| C31 | 400/404/502 -> BadRequest/NotFound/BadGateway | `maps domain errors to http` ✓ | `print-profiles.controller.spec.ts:28-30` - `toBeInstanceOf(type)`, `getStatus() toBe(status)`, `message toBe(...)` | PASS |
| C32 | token -> HttpMakerWorldClient; AppModule imports module | `wires the http client` ✓ | `print-profiles.module.spec.ts:9` - `toBeInstanceOf(HttpMakerWorldClient)`; `print-profiles.module.spec.ts:13` - regex over `app.module.ts`. Assemblies read directly: `api/src/app.module.ts:21` lists the module, `api/src/main.ts:2` imports `AppModule`, and `print-profiles.module.ts:10` binds the token | PASS |
| C33 | no typeorm import under print-profiles | `test -z "$(grep -rlE ...)"` exit 0 | `api/src/modules/print-profiles/print-profiles.module.ts:6-12` - module without `TypeOrmModule`; the grep returns no file | PASS |
| C34 | form filled from the import, swatches colored | web `fills the form from the import` ✓ | `web/src/components/print-profile-import.test.tsx:64-68` - `"0"`, `"28"`, AMS, `"X2D"`, `"0,4"`; `print-profile-import.test.tsx:71-82` - 2 rows, values, `backgroundColor` | PASS |
| C35 | "Importando…" + button disabled | web `shows importing` ✓ | `print-profile-import.test.tsx:90-93` - `getByText("Importando…")`, `disabled toBe(true)` | PASS |
| C36 | 3 labelled options, `3387944` selected, switch without refetch | web `switches profile without refetch` ✓ | `print-profile-import.test.tsx:104-110` - `toHaveLength(3)`, the 3 labels; `print-profile-import.test.tsx:111` - `select.value toBe("3387944")`; `print-profile-import.test.tsx:114-117` - `"21"`/`"24"`, 4 rows, `toHaveBeenCalledTimes(1)` | PASS |
| C37 | `printer.name` and `filaments[0].grams` null -> blank and editable | web `null fields are blank and editable` ✓ | `print-profile-import.test.tsx:131-138` - `toBe("")` x2, then `"A1 mini"`, `"7,5"`. The claim holds as written; see P9 for AC 24 | PASS |
| C38 | 502 / API-down message with blank form | web `error shows message and blank form` ✓ | `print-profile-import.test.tsx:145-146` - `findByText(UNAVAILABLE)`, `expectBlankForm()` (`print-profile-import.test.tsx:32-39`); `print-profile-import.test.tsx:154-155` - `"Não foi possível conectar à API"`, `expectBlankForm()` | PASS |
| C39 | no profiles -> message + blank form | web `model without profiles` ✓ | `print-profile-import.test.tsx:163-168` - `findByText("Este modelo não tem perfis …")`, `expectBlankForm()` | PASS |
| C40 | initial blank form, add x2, remove 1 | web `blank form and filament rows` ✓ | `print-profile-import.test.tsx:177-195` - `expectBlankForm()`, `not.toHaveBeenCalled()`, `toHaveLength(2)`, `toHaveLength(1)` | PASS |
| C41 | nav link + formatPrintTime 4 cases | web `links to print profiles` ✓ + `rounds to the nearest minute` ✓ | `web/src/components/app-shell.test.tsx:31-32` - link by name, `href toBe("/print-profiles")`; `web/src/lib/format-print-time.test.ts:6-9` - the 4 literals | PASS |
| C42 | default baseUrl uses `node:https` `get`, never `node:http` | `uses node:https for the default base url` ✓ | `makerworld.client.https.spec.ts:36-37` - `httpCalls toHaveLength(0)`, `httpsCalls toHaveLength(1)`; `makerworld.client.https.spec.ts:39-44` - url href, accept, UA regex, `signal toBeInstanceOf(AbortSignal)` | PASS |
| C43 | 90 -> 0 h 2 min, 3569 -> 0 h 59 min, 3570 -> 1 h 0 min | `rounds half a minute up` ✓ | `web/src/lib/format-print-time.test.ts:13-15` - the 3 literals | PASS |
| C44 | url > 2048 chars -> 400 from ValidationPipe, client not called | e2e `url longer than 2048 characters returns 400` ✓ | `print-profiles.e2e-spec.ts:157` - URL of 2087 chars; `print-profiles.e2e-spec.ts:159-162` - `toBe(400)`, `toContain('url')`, `not.toContain('URL inválida')`, `calls toEqual([])` | PASS |
| C45 | `user@`, `user:pass@`, `/models/0` -> 400 + C2 message | `rejects userinfo and non positive design ids` ✓ | `makerworld-url.spec.ts:74-75` - `toBe(400)`, `toBe(INVALID_URL)` over the 3 URLs at `makerworld-url.spec.ts:69-71` | PASS |
| C46 | defaultInstanceId missing or `123` -> first profile | `falls back to the first profile` ✓ | `makerworld-design.mapper.spec.ts:291` - `selectedProfileId toBe(3387944)` | PASS |
| C47 | missing value in one plate -> slot total null; other slots 64/37/61 | `null in one plate makes the slot total null` ✓ | `makerworld-design.mapper.spec.ts:303-304` - `bySlot.get(1)?.grams toBeNull()`, `meters toBeNull()`; `makerworld-design.mapper.spec.ts:305-307` - `toBe(64)`, `toBe(37)`, `toBe(61)` | PASS |
| C48 | `id`/`slot`/`index` never null | `identifiers are never null` ✓ | `makerworld-design.mapper.spec.ts:323` - ids `toEqual([3387944, 3388305, 3377800])`; `makerworld-design.mapper.spec.ts:325-327` - index `[1]`, plate slots `[1, 4]`, profile slots `[1, 4]`; `makerworld-design.mapper.spec.ts:332` - `plates[1].index toBe(2)` | PASS |
| C49 | `https://:pass@…` and a 20-digit id -> 400 + C2 message | `rejects password only userinfo and unsafe design ids` ✓ | `makerworld-url.spec.ts:85-86` - `toBe(400)`, `toBe(INVALID_URL)` over the 2 URLs at `makerworld-url.spec.ts:81-82` | PASS |
| C50 | 2048-char valid URL -> 200, client gets 3007827 | e2e `url with exactly 2048 characters is accepted` ✓ | `print-profiles.e2e-spec.ts:168` - `toHaveLength(2048)`; `print-profiles.e2e-spec.ts:170-171` - `toBe(200)`, `calls toEqual([3007827])` | PASS |
| C51 | success then 502 / empty -> message, no selector, blank form | web `a failed or empty import after a success clears the form` ✓ | `print-profile-import.test.tsx:223` - `filamentRows() toHaveLength(2)` (precondition); `print-profile-import.test.tsx:226-228` - `findByText(message)`, `queryByRole("combobox") toBeNull()`, `expectBlankForm()` | PASS |
| C52 | 3377800 plates 1 and 10 keep their own `[slot, g, m]` | `each plate keeps its own filament values` ✓ | `makerworld-design.mapper.spec.ts:339-343` - `gramsOf(1) toEqual([[1, 19, 6.19], [2, 12, 3.82], [3, 7, 2.3]])`; `makerworld-design.mapper.spec.ts:344-348` - `gramsOf(10) toEqual([[1, 41, 13.46], [2, 7, 2.13], [4, 30, 9.85]])` | PASS |
| C53 | slot 1 dropped from plate 1 -> profile filaments still `[1,227],[2,64],[3,37],[4,61]` | `profile filaments are ordered by slot` ✓ | `makerworld-design.mapper.spec.ts:354` - plate 1 filtered to slots `2, 3` (out-of-order input); `makerworld-design.mapper.spec.ts:356-361` - `toEqual([[1, 227], [2, 64], [3, 37], [4, 61]])` | PASS |
| C54 | exactly 2049 chars -> 400 from ValidationPipe, client not called | e2e `url with exactly 2049 characters returns 400` ✓ | `print-profiles.e2e-spec.ts:177` - `url toHaveLength(2049)`; `print-profiles.e2e-spec.ts:179-182` - `toBe(400)`, `toContain('url')`, `not.toContain('URL inválida')`, `calls toEqual([])` | PASS |
| C55 | `selectedProfileId` 3377800 (not the first) -> selector on 3377800, 21 h 24 min, 4 rows | web `opens on the selected profile, not the first one` ✓ | `web/src/components/print-profile-import.test.tsx:233` - response with `selectedProfileId: 3377800`; `print-profile-import.test.tsx:239` - `select.value toBe("3377800")`; `print-profile-import.test.tsx:240-242` - `"21"`, `"24"`, `filamentRows() toHaveLength(4)` | PASS |

Precision gaps. These are findings about the checks, not about the code:

- **P8 (round 4) is closed.** C55 uses a response whose `selectedProfileId` is not `profiles[0]`,
  and I6 now dies.
- **P9 (new, C37 and AC 24).** AC 24 covers every field that can come back `null`. C37 claims two
  of them (`printer.name` and `filaments[0].grams`), and nothing else pins the rest, so the claim
  is correct but narrower than its criterion (N7–N9). AC 24 also says "vazio" without saying what
  that means for the AMS checkbox. The code chooses unchecked (`print-profile-import.tsx:67`).
  A check should fix that, because unchecked is also what `needsAms: false` shows.

Notes:

- The 5 MB `content-length` pre-check (`makerworld.client.ts:120-124`) is still never exercised,
  because the C21 "too large" case is chunked. Removing it (N3) is equivalent for every claim,
  because the streamed count at `makerworld.client.ts:127-133` still refuses the same body with
  the same 502 and the same `too large` log. This is carried from `19ce72b`, re-run at
  `4cb1a22`, and the source is unchanged.
- Round 4's I1–I4 are not re-counted. The code they touch is unchanged, and I found no
  requirement that they break.
- Swept re-read at `4cb1a22`: the global `ValidationPipe` with `whitelist` and
  `forbidNonWhitelisted` is still at `api/src/app.setup.ts:9-13`. AD-011 is at `.specs/STATE.md:17`
  and supersedes AD-009 (`.specs/STATE.md:15`). The `n/a` rows are approved policy.

## Coverage

I recomputed each set at `4cb1a22` from its authority. For sets the code must satisfy, the
authority is the plan's `Surface`, `Landing`, `Criteria` and `Observable`. For sets the code
discovers, it is the code's own branches. The production source is byte-identical to `6f4a6ed`,
so I re-read the code-derived member lists against `makerworld-url.ts`,
`makerworld-design.mapper.ts`, `makerworld.client.ts`, the controller, the DTO and
`print-profile-import.tsx`, and settled the members in doubt by mutation.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| route statuses (4) | plan `Surface` | 200 C24, C30, C50 · 400 C26, C27, C28, C44, C54 · 404 C29 · 502 C29 | - |
| accepted URLs (7) | plan AC 8 | all 7 in C1 (`makerworld-url.spec.ts:23-34`) | - |
| refused URLs, plan AC 13 (8) | plan AC 13 | all 8 in C2 (`makerworld-url.spec.ts:42-49`) | - |
| refusal branches of `parseMakerWorldUrl` (code, 9) | `makerworld-url.ts:15-33` | parse C2 · scheme C2 · host C2 · port C2 · username C45 · password C49 (G2 killed) · path C2 · unsafe integer C49 · `<= 0` C45 | - |
| profile fragment (3 forms) | `makerworld-url.ts:35-39`, AC 5 | valid C1 · malformed C3 · absent C1, C8 | - |
| request body refusals (4) | DTO + `app.setup.ts:9-13` | missing C27 · not text C27 · extra key C27 · over the bound C44, C54 | - |
| `url` length bound (2 sides) | `dto/import-print-profile.dto.ts:5` | 2048 accepted C50 · 2049 refused C54 (H4 killed) | - |
| nullable scalars in the API (19) | door 1 + `print-profiles.types.ts` | table-driven in C11 | - |
| door 1 non-null identifiers (3) | plan `Landing` door 1 | `id` C48 · `slot` C48 · `index` C48 | - |
| door 1 `plates[].filaments` per plate (2 shapes) | plan `Landing` door 1 + AC 4 | single plate C5, C24 · multi-plate, per-plate values C52 (H16 killed) | - |
| plate sum with a missing value (2) | `sumOrNull` `mapper.ts:151-153`, AC 9 | both present C7 · one `null` -> `null` C47 (G3 killed) | - |
| profile filament order (2) | AC 2, `Observable` ordering, `mapper.ts:148` | slots in ascending order C5, C7 · slots out of order C53 (H2 killed) | - |
| invalid numbers (4) | AC 10 | all in C12 | - |
| format normalization (4) | door 1 | all in C13 | - |
| filament origin (2) | `mapper.ts:92-95` | plates C5, C7, C52, C53 · instanceFilaments C14 | - |
| profile selection in the API (5 branches) | `selectProfile` `mapper.ts:46-66`, AC 5 | given C4 · unknown C16, C28 · default C8 · first C46 · none C15 | - |
| profile the screen opens on (2) | AC 23, `print-profile-import.tsx:98` | `selectedProfileId` is the first profile C36 · is not the first profile C55 (I6 killed) | - |
| null fields shown blank on the screen (8) | AC 24 + the form fields `print-profile-import.tsx:62-78` fed by door-1 nullable scalars | `printer.name` C37 · `filament.grams` C37 | `printSeconds` (Horas/Minutos, N9 survived) · `needsAms` (N7 survived) · `printer.nozzleDiameterMm` · `filament.type` (N8 survived) · `filament.color` · `filament.meters` |
| fixture profiles (3) | fixture `instances[]` | 3387944 C4 · 3377800 C7, C52, C53 · 3388305 C10 | - |
| unrecognized response (4) | AC 17 | all in C17 | - |
| upstream failures (7) | AC 17 + `makerworld.client.ts` | table-driven in C21, logged C22 (M4 killed), timeout C23 | - |
| domain -> HTTP (3) | `print-profiles.controller.ts:35-43` | C31 (M5 killed); at the route C26, C28, C29 | - |
| screen states (5) | plan `Observable` + AC 21–28 | idle C40 · loading C35 · loaded C34 · error C38 · empty C39 | - |
| form reset when leaving `loaded` (2) | AC 25, AC 26 | loaded -> error C51 (G7 killed) · loaded -> empty C51 | - |
| filament row actions (2) | AC 27 | add C40 · remove C40 | - |
| time formatting (5 cases) | assumption "Tempo na tela" | C41, C43 (F6 killed) | - |
| one-way doors (4) | plan `Landing` | 1 C24, C13, C48, C52 · 2 C18, C32 · 3 C18, C19, C21, C23, C25 · 4 C42 (F9 killed) | - |
| startup config (2) | assemblies read directly | `main.ts:2` -> `AppModule` -> `app.module.ts:21` (C32) · token -> `HttpMakerWorldClient` `print-profiles.module.ts:10` (C32, M6 killed) | - |

## Test policy rows

Verified at `4cb1a22`.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached through the route | `makerworld-url.ts`, `makerworld-design.mapper.ts` | route C24–C30, C44, C50, C54 · own layer C1–C17, C45–C49, C52, C53 | yes - every row of the decision table has a case. G2, G3, H2 and H16 were killed |
| Decides, outside the route (HTTP client) | `makerworld.client.ts` | own layer against a local server C18–C23 + https C42 | yes - the happy path, 404, all 7 failures and the https branch are proven. F9 and M4 were killed |
| Input that does not decide (controller) | `print-profiles.controller.ts`, `dto/import-print-profile.dto.ts` | route C24, C26–C30, C44, C50, C54 (+ C31 own layer) | yes - the accepted input, each of the 4 refusal kinds, both sides of the length bound and each error are proven. H4, M5 and I5 were killed |
| Screen component | `print-profile-import.tsx`, `app-shell.tsx`, `format-print-time.ts` | Testing Library C34–C41, C43, C51, C55 | yes - every screen state (idle, loading, loaded, error, empty) and both resets from `loaded` are proven. I6, G7, F6 and M9 were killed. The AC 24 gap (N7–N9) is about fields inside the `loaded` state, not a state of its own, so it is recorded under Coverage and P9 |

## Faults injected

Isolation: I recorded the real tree's porcelain first (`?? .playwright-mcp/`). Then I ran
`git worktree add --detach <scratchpad>/wt5 HEAD` at `4cb1a22`, symlinked `api/node_modules` and
`.env`, and APFS-cloned `web/node_modules`. A script applied each mutant as an exact
single-occurrence replacement, ran the covering command, reverted it with `git checkout -- <file>`
and checked that the worktree's porcelain was clean afterwards (it was, every time). After
`git worktree remove`, the real tree's porcelain matched the baseline, `git worktree list` showed
only the main tree, and `api/node_modules` and `web/node_modules` were intact.

The five-fault cap was deliberately exceeded because the orchestrator asked for three things:
the named earlier survivors re-injected, at least one fault per assertion surface (11 proof
surfaces), and new probes. Re-injections and surface faults ran the narrowest covering spec file.
The N probes ran the **whole** relevant suite (API unit plus e2e, or all of web), so a survivor
there survived everything.

| Mutation | Location | Killed |
| --- | --- | --- |
| I6 (round 4) the screen opens `profiles[0]` instead of `selectedProfileId` | `web/src/components/print-profile-import.tsx:98` | yes - C55 (`expected '3387944' to be '3377800'`) |
| F9 (round 1) https branch uses `httpGet` | `api/src/modules/print-profiles/makerworld.client.ts:86` | yes - C42 (`to have a length of +0 but got 1`) |
| F6 (round 1) `Math.round` -> `Math.floor` | `web/src/lib/format-print-time.ts:8` | yes - C43 (`expected '0 h 1 min' to be '0 h 2 min'`) |
| G3 (round 2) `sumOrNull` -> `(a ?? 0) + (b ?? 0)` | `api/src/modules/print-profiles/makerworld-design.mapper.ts:152` | yes - C47 (`expected 239 to be null`) |
| G7 (round 2) error path keeps the old form (`setForm(BLANK_FORM)` removed) | `web/src/components/print-profile-import.tsx:110` | yes - C51 (`expected '0' to be ''`) |
| H2 (round 3) drop the slot sort in `sumBySlot` | `api/src/modules/print-profiles/makerworld-design.mapper.ts:148` | yes - C53 (`expected [ [ 2, 64 ], [ 3, 37 ], …(2) ] to deeply equal [ [ 1, 227 ], …`) |
| H16 (round 3) store the plate's own object in `sumBySlot` (no `{ ...filament }` copy) | `api/src/modules/print-profiles/makerworld-design.mapper.ts:140` | yes - C52 (`expected [ [ 1, 246, 79.82… ] … ] to deeply equal [ [ 1, 19, 6.19 ] …`) |
| H4 (round 3) `@MaxLength(2048)` -> `@MaxLength(2049)` | `api/src/modules/print-profiles/dto/import-print-profile.dto.ts:5` | yes - C54 (`expected 200 to be 400`) |
| G2 (url surface) drop the `url.password` clause | `api/src/modules/print-profiles/makerworld-url.ts:25` | yes - C49 (`expected PrintProfileError`) |
| M4 (client surface) 3xx logged as `status 301`, not `redirect` | `api/src/modules/print-profiles/makerworld.client.ts:115` | yes - C22 (`expected 'MakerWorld design 3007827: status 301' to contain 'redirect'`) |
| M5 (controller surface) 404 -> `BadGatewayException` | `api/src/modules/print-profiles/print-profiles.controller.ts:40` | yes - C31 (`to be an instance of NotFoundException`) |
| M6 (module surface) client token wired to a stub value | `api/src/modules/print-profiles/print-profiles.module.ts:10` | yes - C32 (`expected {} to be an instance of HttpMakerWorldClient`) |
| M9 (app-shell surface) nav link `href` -> `/print-profile` | `web/src/components/app-shell.tsx:18` | yes - C41 (`expected '/print-profile' to be '/print-profiles'`) |
| M10 (C33 surface) `typeorm` import added to the service | `api/src/modules/print-profiles/print-profiles.service.ts:1` | yes - C33 (shell proof exit 1) |
| I5 (e2e surface) drop `@HttpCode(200)` on the route | `api/src/modules/print-profiles/print-profiles.controller.ts:22` | yes - C24, C30 and C50 (`expected 201 to be 200`) |
| N7 a null `needsAms` opens checked (`?? false` -> `?? true`) | `web/src/components/print-profile-import.tsx:67` | no - survived the whole web suite (22/22). Counted: AC 24 says a null field shows empty, and the user sees "Precisa de AMS" checked for a profile whose AMS need MakerWorld did not report |
| N8 a null filament `type` opens as `PLA` (`?? ""` -> `?? "PLA"`) | `web/src/components/print-profile-import.tsx:73` | no - survived the whole web suite (22/22). Counted: AC 24. A material MakerWorld did not report is shown pre-filled, and a wrong material misprices the part |
| N9 a null `printSeconds` opens with hours `0` (`: ""` -> `: "0"`) | `web/src/components/print-profile-import.tsx:65` | no - survived the whole web suite (22/22). Counted: AC 24. An unknown print time shows as a number |
| N1 `toRate` without the `<= 100` bound (`"150%"` -> `1.5`) | `api/src/modules/print-profiles/makerworld-design.mapper.ts:196` | survived both API suites (80/80, 31/31) - not counted. No AC, check or door bounds the rate above, and MakerWorld does not send infill above 100% |
| N2 `toColor` refuses `#RRGGBBAA` instead of dropping the alpha | `api/src/modules/print-profiles/makerworld-design.mapper.ts:204` | survived both API suites - not counted. Door 1 allows `null` colour and fixes only the `#RRGGBB` shape. No AC or check names 8-digit input, and the fixture has none |
| N3 drop the `content-length` pre-check (carried note) | `api/src/modules/print-profiles/makerworld.client.ts:120-124` | survived the API unit suite (80/80) - not counted. Equivalent: the streamed count at `makerworld.client.ts:127-133` refuses the same body with the same 502 and log reason |
| N4 numeric `0` -> `null` in `toNonNegative` (`>= 0` -> `> 0`) | `api/src/modules/print-profiles/makerworld-design.mapper.ts:176` | survived both API suites - not counted. The number branch only carries `prediction`, `weight` and `nozzleDiameter` (the fixture's `usedG`/`usedM` are strings), where zero is not a physical value. AC 10 decides negatives, not zero |
| N5 the screen drops the `profiles[0]` fallback (`?? result.profiles[0]?.id` -> `?? undefined`) | `web/src/components/print-profile-import.tsx:98` | survived the whole web suite - not counted. Equivalent under door 1: the API returns `selectedProfileId: null` only when `profiles` is empty (`mapper.ts:65`), and that case is C39 |
| N6 any object with an `id` key is a design (`isPositiveInteger(design.id)` -> `'id' in design`) | `api/src/modules/print-profiles/makerworld-design.mapper.ts:20` | survived both API suites - not counted. It changes only `{ id: <non-numeric> }`. AC 17 says "objeto JSON com `id`", which that input satisfies literally, and C17 claims its four forms, which still die |

Tally: 24 injected, 15 killed, 9 survived. 3 survivors are counted (N7, N8 and N9, all AC 24).
6 are not counted: N3 and N5 are equivalent, and N1, N2, N4 and N6 change behaviour that no
requirement decides.

## Gate

Run once in the scratch worktree at `4cb1a22`, on a clean tree:

- `npm --prefix api run lint`: exit 0
- `npm --prefix api run test`: 80 passed, 0 failed (15 files)
- `npm --prefix api run test:e2e`: 31 passed, 0 failed (5 files)
- `npm --prefix api run build`: exit 0
- `npm --prefix web run lint`: exit 0
- `npm --prefix web run test`: 22 passed, 0 failed (5 files)
- `npm --prefix web run build`: exit 0, with `/print-profiles` prerendered

## Ranked gaps

1. AC 24 (null field shown empty and editable) is proven on 2 of the 8 nullable fields the form
   shows (P9, and N7, N8 and N9 survived). This is at `web/src/components/print-profile-import.tsx:65-76`,
   and the only claim is at `web/src/components/print-profile-import.test.tsx:131-133`. The code
   is correct today, but a regression that pre-fills `PLA`, a `0` hour or a checked AMS for data
   MakerWorld never sent would go unnoticed. It needs one web case that nulls `printSeconds`,
   `needsAms`, `printer.nozzleDiameterMm` and a filament's `type`, `color` and `meters`, and
   asserts that Horas, Minutos, Bico, Tipo, Cor and Metros are `""`, that AMS is unchecked, and
   that each is editable.

## Lessons

The Verifier was told to change nothing outside this report, so `scripts/lessons.py` was not run.
Proposed lesson for the orchestrator:

- A criterion that says "every null field is shown blank" needs a case that nulls every field the
  screen renders, not a sample of two. Otherwise each field's fallback is free to drift.
