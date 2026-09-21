# Fase 2 — Dados de impressão pela URL do MakerWorld verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 5df0c52..87c2c72
**Round**: 6 - scoped
**Verifier**: independent sub-agent (author != verifier)

`verify.md` bounds verification at three rounds before escalating to the user. The user
explicitly authorised round 4, round 5 and this round 6. This round is **scoped**, as
`verify.md` "Re-verifying after a fix" prescribes: the fix's diff plus every verdict that was
not PASS, and everything else carried forward with its origin named.

The fix under review is `git diff 4cb1a22..87c2c72`. It appends one web test (C56) to
`web/src/components/print-profile-import.test.tsx:245-288` and adds the matching rows to
`checks.md`. No production source changed; `git diff --stat 4cb1a22..87c2c72` touches only
`checks.md`, `verification.md` and that one test file.

Scope of this round:

- **Proofs** - all 56 re-run in full at `87c2c72`, batched by target. Green is a property of a
  commit, so this is never carried.
- **Faults** - re-injected only on the surface the fix created: the C56 assertion surface, the
  `formFromProfile` mapping at `web/src/components/print-profile-import.tsx:65-76`.
- **Coverage** - only the row whose authority the fix touched, "campos nulos vazios e editáveis
  na tela (8)", recomputed from AC 24 and the component. Every other row carried.
- **Citations** - refreshed for the one file the fix touched. The others carried.
- **Test policy** - re-judged the row that classifies the touched file (screen component). The
  other three carried; none was unmet.
- No probing for new gaps outside that scope. That is what a scoped round excludes.

Earlier rounds (in git history):

- Round 1 at `6f4a6ed`: FAIL. C1–C41 proven; F9 (https transport), F6 (`Math.floor`) and F10 (no `@MaxLength`) survived. C42–C46 added.
- Round 2 at `19ce72b`: FAIL. C1–C46 proven and round-1 mutants killed; probes G1–G7 and G9 survived. C47–C51 added.
- Round 3 at `6354794`: FAIL. C1–C51 proven and every earlier mutant killed; H2 (slot sort), H16 (per-plate copy) and H4 (2049 bound) survived. C52–C54 added.
- Round 4 at `ad8a745`: FAIL. C1–C54 proven and every earlier mutant killed; I6 (screen opens on `profiles[0]`) survived. C55 added; I1–I4 recorded as notes.
- Round 5 at `4cb1a22`: FAIL. C1–C55 proven, I6 and all earlier mutants killed; one counted gap (AC 24 proven on 2 of 8 nullable form fields, survivors N7–N9, finding P9). C56 added. N1–N6 recorded as not counted.

**The round-5 gap is closed.** C56 exists, runs and passes at `87c2c72`, and the three round-5
survivors now die, together with three more faults on the same surface (colour, metres, nozzle).
The Coverage row that was the only one carrying an unproven member is now complete. Nothing else
in the report was contradicted by the fix.

## Binding sources

Carried from `4cb1a22`. Step 1 runs only under `ui`, and this feature was approved under
`standard`. The plan marks no source as binding: `Sources` lists `ROADMAP.md` and the MakerWorld
response of 2026-09-21 only as provenance, so no comparison was owed. The fix touches no
interface, so the scoped-round trigger for step 1 did not fire either.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| none - the plan marks no source binding | n/a - `standard` | none | - |

## Checks

**Proof runs verified at `87c2c72`.** I ran them in the real tree, read-only, one invocation per
target. Every named test appears individually as ✓ in the verbose output:

- **API unit.** `npm --prefix api run test -- <the 6 print-profiles spec files> --reporter=verbose -t "<33 names joined by |>"`
  exited 0: 6 files passed, 33 passed and 1 skipped. The skipped test is `other errors are not
  converted`, which is not a proof of any check.
- **e2e.** `npm --prefix api run test:e2e -- test/print-profiles.e2e-spec.ts --reporter=verbose -t "<10 names>"`
  exited 0 with 10/10 passed, against the migrated `forge_test` database.
- **Web.** `npm --prefix web run test -- src/components/print-profile-import.test.tsx src/components/app-shell.test.tsx src/lib/format-print-time.test.ts --reporter=verbose -t "<13 names>"`
  exited 0 with 13 passed and 1 skipped. The skipped test is `renders header, nav and content`,
  which is not a proof of any check.
- **C33.** The shell proof exited 0.

33 + 10 + 13 names and the shell command settle 56 checks (C41 carries two proof names). No
filter matched nothing: each name printed its own ✓ line with its file and describe block.

**Citations for `web/src/components/print-profile-import.test.tsx` refreshed at `87c2c72`.** The
fix is a pure append at `@@ -241,4 +241,49 @@`, so every line before 244 is unmoved; I confirmed
the `it(` anchors (52, 86, 96, 120, 141, 158, 171, 198, 232) are where round 4 and round 5 left
them, and C56's body is at 245-288. **Citations for every other file carried from `4cb1a22`** -
those files are byte-identical across `4cb1a22..87c2c72`.

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
| C32 | token -> HttpMakerWorldClient; AppModule imports module | `wires the http client` ✓ | `print-profiles.module.spec.ts:9` - `toBeInstanceOf(HttpMakerWorldClient)`; `print-profiles.module.spec.ts:13` - regex over `app.module.ts`. Assemblies read directly: `api/src/app.module.ts:21` lists the module, `api/src/main.ts:2` imports `AppModule`, `print-profiles.module.ts:10` binds the token | PASS |
| C33 | no typeorm import under print-profiles | `test -z "$(grep -rlE ...)"` exit 0 | `api/src/modules/print-profiles/print-profiles.module.ts:6-12` - module without `TypeOrmModule`; the grep returns no file | PASS |
| C34 | form filled from the import, swatches colored | web `fills the form from the import` ✓ | `web/src/components/print-profile-import.test.tsx:64-68` - `"0"`, `"28"`, AMS, `"X2D"`, `"0,4"`; `print-profile-import.test.tsx:71-82` - 2 rows, values, `backgroundColor` | PASS |
| C35 | "Importando…" + button disabled | web `shows importing` ✓ | `print-profile-import.test.tsx:90-93` - `getByText("Importando…")`, `disabled toBe(true)` | PASS |
| C36 | 3 labelled options, `3387944` selected, switch without refetch | web `switches profile without refetch` ✓ | `print-profile-import.test.tsx:104-110` - `toHaveLength(3)`, the 3 labels; `print-profile-import.test.tsx:111` - `select.value toBe("3387944")`; `print-profile-import.test.tsx:114-117` - `"21"`/`"24"`, 4 rows, `toHaveBeenCalledTimes(1)` | PASS |
| C37 | `printer.name` and `filaments[0].grams` null -> blank and editable | web `null fields are blank and editable` ✓ | `print-profile-import.test.tsx:131-138` - `toBe("")` x2, then `"A1 mini"`, `"7,5"` | PASS |
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
| C56 | 6 nulled sources -> Horas, Minutos, Bico, Tipo, Cor, Metros are `""` and accept typing; AMS unchecked and checkable | web `every null field of the form is blank and editable` ✓ | `web/src/components/print-profile-import.test.tsx:257-262` - the 6 nulls (`printSeconds`, `needsAms`, `printer.nozzleDiameterMm`, `filaments[0].type/.color/.meters`); `print-profile-import.test.tsx:270` - `expect(ams.checked).toBe(false)`; `print-profile-import.test.tsx:272` - `expect(ams.checked).toBe(true)` after `fireEvent.click`; `print-profile-import.test.tsx:284` - `expect(input.value).toBe("")` and `print-profile-import.test.tsx:286` - `expect(input.value).toBe(typed)`, over the 6 labelled inputs listed at `print-profile-import.test.tsx:276-281` (`Horas` "1", `Minutos` "5", `Bico (mm)` "0,6", `Tipo` "PETG", `Cor` "#00FF00", `Metros` "3,1") | PASS |

Precision gaps:

- **P9 (round 5) is closed.** C56 nulls the six remaining sources behind the eight form fields
  and asserts each is `""` and editable, and it resolves AC 24's silence about the AMS
  checkbox by claiming that "vazio" there means unchecked - `checks.md:231` says so explicitly,
  and `print-profile-import.test.tsx:270-272` asserts it in both directions (unchecked on open,
  checkable afterwards). The remaining looseness is that unchecked is also what `needsAms: false`
  renders, so the checkbox alone cannot distinguish `null` from `false`. That is a property of a
  two-state control, it is now written down rather than assumed, and C10 pins `false` at the API
  layer. Recorded, and it carries no unproven member.
- P8 (round 4) was closed by C55 and stays closed - `print-profile-import.test.tsx:233-242` is
  unmoved and green.

Notes carried from `4cb1a22`:

- The 5 MB `content-length` pre-check (`api/src/modules/print-profiles/makerworld.client.ts:120-124`)
  is never exercised, because the C21 "too large" case is chunked. Round 2 and round 5 both judged
  removing it equivalent for every claim: the streamed count at `makerworld.client.ts:127-133`
  refuses the same body with the same 502 and the same `too large` log. The source is unchanged at
  `87c2c72`, so that judgment carries.
- Round 4's I1–I4 and round 5's N1–N6 were judged as notes, either equivalent under the door-1
  contract or changing behaviour that no AC, check or door decides. They touch API sources that
  are byte-identical at `87c2c72`, and this round's scope excludes re-probing them.
- Swept re-read carried from `4cb1a22`: the global `ValidationPipe` with `whitelist` and
  `forbidNonWhitelisted` is at `api/src/app.setup.ts:9-13`; AD-011 is at `.specs/STATE.md:17` and
  supersedes AD-009 (`.specs/STATE.md:15`). The `n/a` rows are policy the user approved.

## Coverage

One row **recomputed at `87c2c72`**; every other row **carried from `4cb1a22`**, where it was
recomputed from its authority and left nothing unproven. The fix changed no production source and
added no branch, so no other row's authority moved.

The recomputed row is "campos nulos vazios e editáveis na tela (8)". Its authority sits outside
the code - AC 24 at `.specs/features/phase-2-makerworld-profiles/plan.md:126`, "WHEN um campo
volta `null` THEN the system SHALL mostrá-lo vazio e editável" - and the members are the form
fields that AC 24 governs. I took them from `FormState`
(`web/src/components/print-profile-import.tsx:12-24`) crossed with `formFromProfile`
(`print-profile-import.tsx:61-78`), which is the only place a nullable API value becomes a form
value. Eight nullable sources feed nine controls:

| Source (nullable, per door 1) | Control | Fallback | Proof |
| --- | --- | --- | --- |
| `profile.printSeconds` | Horas + Minutos | `print-profile-import.tsx:65-66` `time ? … : ""` | C56 (N9 died) |
| `profile.needsAms` | Precisa de AMS | `print-profile-import.tsx:67` `?? false` | C56 (N7 died) |
| `profile.printer.name` | Impressora | `print-profile-import.tsx:68` `?? ""` | C37 |
| `profile.printer.nozzleDiameterMm` | Bico (mm) | `print-profile-import.tsx:69` `decimal()` -> `""` | C56 (N12 died) |
| `filament.type` | Tipo | `print-profile-import.tsx:73` `?? ""` | C56 (N8 died) |
| `filament.color` | Cor | `print-profile-import.tsx:74` `?? ""` | C56 (N10 died) |
| `filament.grams` | Gramas | `print-profile-import.tsx:75` `decimal()` -> `""` | C37 |
| `filament.meters` | Metros | `print-profile-import.tsx:76` `decimal()` -> `""` | C56 (N11 died) |

`filament.slot` is the ninth form value and is excluded on purpose: door 1 makes it non-null and
C48 proves it. The `settings` scalars (`layerHeightMm`, `wallLoops`, `sparseInfillRate`) and
`model.*` are nullable in the API but are not form fields, so AC 24's "editável" does not reach
them; they stay covered by the 19-scalar API row. So the set is eight, the declared size matches,
and every member now has a proof whose failure I observed.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| null fields shown blank on the screen (8) - **recomputed at `87c2c72`** | AC 24 (`plan.md:126`) + `FormState` and `formFromProfile` (`print-profile-import.tsx:12-24, 61-78`) | `printer.name` C37 · `filament.grams` C37 · `printSeconds` (Horas + Minutos) C56 · `needsAms` C56 · `printer.nozzleDiameterMm` C56 · `filament.type` C56 · `filament.color` C56 · `filament.meters` C56 | - |
| route statuses (4) - carried from `4cb1a22` | plan `Surface` | 200 C24, C30, C50 · 400 C26, C27, C28, C44, C54 · 404 C29 · 502 C29 | - |
| accepted URLs (7) - carried from `4cb1a22` | plan AC 8 | all 7 in C1 (`makerworld-url.spec.ts:23-34`) | - |
| refused URLs, plan AC 13 (8) - carried from `4cb1a22` | plan AC 13 | all 8 in C2 (`makerworld-url.spec.ts:42-49`) | - |
| refusal branches of `parseMakerWorldUrl` (code, 9) - carried from `4cb1a22` | `makerworld-url.ts:15-33` | parse C2 · scheme C2 · host C2 · port C2 · username C45 · password C49 · path C2 · unsafe integer C49 · `<= 0` C45 | - |
| profile fragment (3 forms) - carried from `4cb1a22` | `makerworld-url.ts:35-39`, AC 5 | valid C1 · malformed C3 · absent C1, C8 | - |
| request body refusals (4) - carried from `4cb1a22` | DTO + `app.setup.ts:9-13` | missing C27 · not text C27 · extra key C27 · over the bound C44, C54 | - |
| `url` length bound (2 sides) - carried from `4cb1a22` | `dto/import-print-profile.dto.ts:5` | 2048 accepted C50 · 2049 refused C54 | - |
| nullable scalars in the API (19) - carried from `4cb1a22` | door 1 + `print-profiles.types.ts` | table-driven in C11 | - |
| door 1 non-null identifiers (3) - carried from `4cb1a22` | plan `Landing` door 1 | `id` C48 · `slot` C48 · `index` C48 | - |
| door 1 `plates[].filaments` per plate (2 shapes) - carried from `4cb1a22` | plan `Landing` door 1 + AC 4 | single plate C5, C24 · multi-plate, per-plate values C52 | - |
| plate sum with a missing value (2) - carried from `4cb1a22` | `sumOrNull` `mapper.ts:151-153`, AC 9 | both present C7 · one `null` -> `null` C47 | - |
| profile filament order (2) - carried from `4cb1a22` | AC 2, `Observable` ordering, `mapper.ts:148` | slots ascending C5, C7 · slots out of order C53 | - |
| invalid numbers (4) - carried from `4cb1a22` | AC 10 | all in C12 | - |
| format normalization (4) - carried from `4cb1a22` | door 1 | all in C13 | - |
| filament origin (2) - carried from `4cb1a22` | `mapper.ts:92-95` | plates C5, C7, C52, C53 · instanceFilaments C14 | - |
| profile selection in the API (5 branches) - carried from `4cb1a22` | `selectProfile` `mapper.ts:46-66`, AC 5 | given C4 · unknown C16, C28 · default C8 · first C46 · none C15 | - |
| profile the screen opens on (2) - carried from `4cb1a22` | AC 23, `print-profile-import.tsx:98` | `selectedProfileId` is the first profile C36 · is not the first profile C55 | - |
| fixture profiles (3) - carried from `4cb1a22` | fixture `instances[]` | 3387944 C4 · 3377800 C7, C52, C53 · 3388305 C10 | - |
| unrecognized response (4) - carried from `4cb1a22` | AC 17 | all in C17 | - |
| upstream failures (7) - carried from `4cb1a22` | AC 17 + `makerworld.client.ts` | table-driven in C21, logged C22, timeout C23 | - |
| domain -> HTTP (3) - carried from `4cb1a22` | `print-profiles.controller.ts:35-43` | C31; at the route C26, C28, C29 | - |
| screen states (5) - carried from `4cb1a22` | plan `Observable` + AC 21-28 | idle C40 · loading C35 · loaded C34 · error C38 · empty C39 | - |
| form reset when leaving `loaded` (2) - carried from `4cb1a22` | AC 25, AC 26 | loaded -> error C51 · loaded -> empty C51 | - |
| filament row actions (2) - carried from `4cb1a22` | AC 27 | add C40 · remove C40 | - |
| time formatting (5 cases) - carried from `4cb1a22` | assumption "Tempo na tela" | C41, C43 | - |
| one-way doors (4) - carried from `4cb1a22` | plan `Landing` | 1 C24, C13, C48, C52 · 2 C18, C32 · 3 C18, C19, C21, C23, C25 · 4 C42 | - |
| startup config (2) - carried from `4cb1a22` | assemblies read directly | `main.ts:2` -> `AppModule` -> `app.module.ts:21` (C32) · token -> `HttpMakerWorldClient` `print-profiles.module.ts:10` (C32) | - |

No set in `checks.md`, in the plan's `Landing`, `Relations`, `Surface` or `Observable`, or inside
a claim, lacks a row: the sweep at `4cb1a22` found none, and the fix added no enumeration.

## Test policy rows

One row **re-judged at `87c2c72`** because it classifies the file the fix touched; the other
three **carried from `4cb1a22`**, where each was met. No row was unmet at `4cb1a22`, so the
scoped round owes no other re-judgment.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Componente de tela - **re-judged at `87c2c72`** | `print-profile-import.tsx`, `app-shell.tsx`, `format-print-time.ts` | one with Testing Library; each screen state as a member: C34-C41, C43, C51, C55, C56 | yes - every state has a case (idle C40, loading C35, loaded C34, error C38, empty C39) and both transitions out of `loaded` (C51). The `loaded` state's own fields are now pinned member by member: all eight nullable form fields via C37 and C56, and the profile the screen opens on via C36 and C55. I6, G7, F6, M9 and this round's six faults on `formFromProfile` all died |
| Decide, alcançado pela rota - carried from `4cb1a22` | `makerworld-url.ts`, `makerworld-design.mapper.ts` | route C24-C30, C44, C50, C54 · own layer C1-C17, C45-C49, C52, C53 | yes - every line of the decision table has a case at both levels; G2, G3, H2 and H16 died |
| Decide, fora da rota (cliente HTTP) - carried from `4cb1a22` | `makerworld.client.ts` | own layer against a local server C18-C23 plus https C42 | yes - the happy path, 404, all seven upstream failures and the https branch are proven; F9 and M4 died |
| Entrada que não decide (controller) - carried from `4cb1a22` | `print-profiles.controller.ts`, `dto/import-print-profile.dto.ts` | route C24, C26-C30, C44, C50, C54 plus C31 at its own layer | yes - the accepted input, each of the four refusal kinds, both sides of the length bound and each error are proven; H4, M5 and I5 died |

## Faults injected

**Verified at `87c2c72`.** Isolation: I recorded the real tree's porcelain first (`?? .playwright-mcp/`),
then ran `git worktree add --detach <scratchpad>/wt6 HEAD` at `87c2c72` and symlinked
`web/node_modules`. Each mutant was applied as an exact single-occurrence replacement (asserted
`count == 1`), the covering command was run, and the mutant was reverted with
`git checkout -- web/src/components/print-profile-import.tsx`; the worktree's porcelain was empty
after every revert. Afterwards `git worktree remove --force` plus `git worktree prune` left
`git worktree list` showing only the main tree, and the real tree's porcelain matched the
baseline exactly. The real tree was never mutated and `git stash` was never used.

Scope: the fix touched exactly one assertion surface - the C56 assertions over
`formFromProfile` at `web/src/components/print-profile-import.tsx:61-78`. That surface had never
been made to fail, which is precisely the case `verify.md` calls out ("a fix that *adds* an
assertion ... its new surface has never been made to fail once"). Every other surface's faults
are carried from `4cb1a22` and are not re-run: their production sources are byte-identical.

Each mutation ran the **whole web suite** (`npm --prefix web run test`), not just the narrowest
file, because that is the exact run the three round-5 survivors survived - so a death here is
measured against the same bar that let them live. Six faults exceed the five-fault cap
deliberately: the orchestrator required the three named round-5 survivors plus faults on the
colour, metres and nozzle nulls, and each one forces a different assertion in C56's set.

| Mutation | Location | Killed |
| --- | --- | --- |
| N7 (round 5 survivor) a null `needsAms` opens checked: `?? false` -> `?? true` | `web/src/components/print-profile-import.tsx:67` | yes - C56 `every null field of the form is blank and editable` (`AssertionError: expected true to be false`), 1 failed / 22 passed |
| N8 (round 5 survivor) a null filament `type` opens as `PLA`: `?? ""` -> `?? "PLA"` | `web/src/components/print-profile-import.tsx:73` | yes - C56 (`expected 'PLA' to be ''`), 1 failed / 22 passed |
| N9 (round 5 survivor) a null `printSeconds` opens with hours `0`: `: ""` -> `: "0"` | `web/src/components/print-profile-import.tsx:65` | yes - C56 (`expected '0' to be ''`), 1 failed / 22 passed |
| N10 (new) a null filament `color` opens as black: `?? ""` -> `?? "#000000"` | `web/src/components/print-profile-import.tsx:74` | yes - C56 (`expected '#000000' to be ''`), 1 failed / 22 passed |
| N11 (new) a null filament `meters` opens as `0`: `decimal(filament.meters)` -> `decimal(filament.meters ?? 0)` | `web/src/components/print-profile-import.tsx:76` | yes - C56 (`expected '0' to be ''`), 1 failed / 22 passed |
| N12 (new) a null `nozzleDiameterMm` opens as `0,4`: `decimal(...)` -> `decimal(... ?? 0.4)` | `web/src/components/print-profile-import.tsx:69` | yes - C56 (`expected '0,4' to be ''`), 1 failed / 22 passed |

The killer is C56 in all six cases, and it is the only killer: a verbose re-run of N7 shows C37
(`null fields are blank and editable`) still green beside C56's ✕, which confirms the fix, not a
pre-existing test, closed the gap.

`printSeconds` feeds two controls (Horas and Minutos) through one fallback expression. N9 mutates
the Horas branch; the Minutos branch is the same expression and is asserted at
`print-profile-import.test.tsx:277` and `:284`. A second mutation there would force the same
proof to fail and add no information, which is the duplication `verify.md` tells this step to
avoid.

Carried from `4cb1a22`: 15 faults on the other assertion surfaces (I6, F9, F6, G3, G7, H2, H16,
H4, G2, M4, M5, M6, M9, M10, I5) were all killed at `4cb1a22`, and every source they touch is
unchanged at `87c2c72`. The six round-5 probes judged as not counted (N1-N6) are carried as notes
above, unchanged by the fix and outside this round's scope.

Tally for this round: 6 injected, 6 killed, 0 survived.

## Gate

Run once in the scratch worktree at `87c2c72`, on a clean tree:

- `npm --prefix api run lint`: exit 0
- `npm --prefix api run test`: 80 passed, 0 failed (15 files)
- `npm --prefix api run test:e2e`: 31 passed, 0 failed (5 files)
- `npm --prefix api run build`: exit 0
- `npm --prefix web run lint`: exit 0
- `npm --prefix web run test`: 23 passed, 0 failed (5 files) - one more than round 5's 22, which is C56
- `npm --prefix web run build`: exit 0, with `/print-profiles` prerendered

## Ranked gaps

None. The single gap of round 5 is closed, no carried-forward row is unproven, no `Test policy`
row is unmet, and no mutant survived.

One thing outside this round's scope remains outstanding for the feature as a whole, and it was
outstanding at every earlier round too: nothing in the suite proves the live MakerWorld still
answers in the fixture's format. `checks.md` states this in its Coverage prose, and `AGENTS.md`
asks for the Playwright MCP pass against the running app. That pass is the orchestrator's, not
the Verifier's, and it gates go-live rather than this report.

## Lessons

The Verifier was told to change nothing outside this report, so `scripts/lessons.py` was not run.
Proposed lessons for the orchestrator:

- A criterion that says "every null field is shown blank" needs a case that nulls every field the
  screen renders, not a sample of two. Otherwise each field's fallback is free to drift. (Round 5,
  now closed by C56.)
- When a criterion says "empty" about a two-state control such as a checkbox, write down which
  state that is before the test, because the code will pick one silently. `checks.md:231` does
  this for AMS.
