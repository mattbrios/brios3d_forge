# Material brand tone - verification

**Verdict**: PASS
**Profile**: light
**Diff range**: bd45347..477f6c9
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Binding sources: none - the plan's Sources are the user's request and `CONTEXT.md`; nothing is marked binding (step 1 is `ui`-only anyway).

`PAGE` = `web/src/app/(app)/materials/page.test.tsx`. `CB` = `web/src/components/ui/combobox.test.tsx`. `BR` = `api/test/materials-brands.e2e-spec.ts`. `MT` = `api/test/materials.e2e-spec.ts`. `MG` = `api/test/color-hex-migration.e2e-spec.ts`. Every proof below ran at HEAD `477f6c9` in two batched invocations (API e2e: 33 passed / 17 skipped by filter; web: 31 passed / 13 skipped by filter), each named test shown individually as passed in the verbose output. All named tests were added in the diff range (`git diff bd45347..HEAD`), except C42-C44, whose claims are explicitly about pre-existing statuses continuing and are proven by pre-existing tests in `MT` re-run at HEAD.

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | new form opens with empty Tipo/Marca/Cor, no tone, 1,24 / 220 / 65 / 100 | web batch `-t "new material form starts with the usual defaults"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:375` - `expect(input("Densidade (g/cm³)").value).toBe("1,24")` (+ :372-374 `""`, :376-378 `"220"`/`"65"`/`"100"`, :379 `toContain("bf-swatch--none")`) | PASS |
| C2 | untouched defaults sent as numbers in POST | `-t "sends the defaults as numbers"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:390` - `expect(bodyOf(...)).toEqual({ ..., densityGCm3: 1.24, nozzleTempC: 220, bedTempC: 65, minimumStockGrams: 100 })` | PASS |
| C3 | cleared default minimum sent as null | `-t "cleared default minimum is sent as null"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:410` - `expect(bodyOf(...).minimumStockGrams).toBeNull()` | PASS |
| C4 | after 201 the new form resets to defaults, all fields changed before | `-t "resets the new form to the defaults after saving"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:429` - `expect(input("Densidade (g/cm³)").value).toBe("1,24")` (+ :426-428 `""`, :430-432, :433 `bf-swatch--none`, :434 no Remover) | PASS |
| C5 | 400 keeps typed values (brand, tone) and shows API error | `-t "keeps the typed values when the create fails"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:447` - `expect(await screen.findByText("type must be shorter")).toBeTruthy()`; :449 `brandBox().value).toBe("Voolt")`; :451 `input("Tom").value).toBe("#ff8800")` | PASS |
| C6 | edit form uses 1,1 / 200 / 50 / empty minimum | `-t "edit form uses the material values, never the defaults"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:462` - `toBe("1,1")`; :463 `toBe("200")`; :464 `toBe("50")`; :465 `toBe("")` | PASS |
| C7 | GET /materials/brands 200 string array for admin, production, sales | API batch `-t "GET /materials/brands answers 200 for role"` exit 0, ran x3 (admin, production, sales) | `api/test/materials-brands.e2e-spec.ts:60` - `brandsReq(cookies[role]).expect(200)`; :62 `expect(res.body).toEqual(['Voolt'])` | PASS |
| C8 | no session -> 401 with session error body | `-t "GET /materials/brands without a session is 401"` exit 0, ran | `api/test/materials-brands.e2e-spec.ts:66` - `.expect(401)`; :68 `expect(res.body).toEqual(SESSION_REQUIRED)` (literal at :12) | PASS |
| C9 | route returns exactly ["Anycubic","bambu","VOOLT"] | `-t "route groups, keeps the newest spelling and orders brands"` exit 0, ran | `api/test/materials-brands.e2e-spec.ts:85` - `expect(res.body).toEqual(['Anycubic', 'bambu', 'VOOLT'])` | PASS |
| C10 | listBrands groups voolt/Voolt into one entry | `-t "listBrands groups brands ignoring case"` exit 0, ran | `api/test/materials-brands.e2e-spec.ts:94` - `expect(await service.listBrands()).toEqual(['Voolt'])` | PASS |
| C11 | spelling of newest created_at, both orders | `-t "listBrands keeps the spelling of the newest material"` exit 0, ran | `api/test/materials-brands.e2e-spec.ts:100` - `toEqual(['VOOLT'])`; :105 `toEqual(['voolt'])` | PASS |
| C12 | created_at tie broken by greater id | `-t "listBrands breaks a created_at tie by the greater id"` exit 0, ran | `api/test/materials-brands.e2e-spec.ts:123` - `expect(await service.listBrands()).toEqual(['VOOLT'])` | PASS |
| C13 | brand only on inactive material is included | `-t "listBrands includes brands of inactive materials"` exit 0, ran | `api/test/materials-brands.e2e-spec.ts:130` - `toEqual(['Anycubic', 'Voolt'])` (Anycubic `active: false` at :128) | PASS |
| C14 | case-insensitive order Anycubic, bambu, Creality | `-t "listBrands orders brands ignoring case"` exit 0, ran | `api/test/materials-brands.e2e-spec.ts:138` - `toEqual(['Anycubic', 'bambu', 'Creality'])` | PASS |
| C15 | no materials -> 200 [] | `-t "GET /materials/brands answers an empty array without materials"` exit 0, ran | `api/test/materials-brands.e2e-spec.ts:72` - `.expect(200)`; :74 `expect(res.body).toEqual([])` | PASS |
| C16 | matchOptions substring anywhere | `-t "matchOptions matches the text anywhere in the option"` exit 0, ran | `web/src/components/ui/combobox.test.tsx:7` - `expect(matchOptions(["3D Fila", "Bambu Lab", "Voolt"], "a", 8)).toEqual(["3D Fila", "Bambu Lab"])` | PASS |
| C17 | matchOptions ignores case and accents (ACAO, açã) | `-t "matchOptions ignores case and accents"` exit 0, ran | `web/src/components/ui/combobox.test.tsx:11` - `toEqual(["Ação 3D"])` for `"ACAO"`; :12 same for `"açã"` | PASS |
| C18 | cap 8 keeps input order, both sides (10 and 8) | `-t "matchOptions caps the result keeping the input order"` exit 0, ran | `web/src/components/ui/combobox.test.tsx:17` - `toEqual(["A1",...,"A8"])` from 10; :19 same from 8 | PASS |
| C19 | blank and whitespace text -> [] | `-t "matchOptions returns nothing for blank text"` exit 0, ran | `web/src/components/ui/combobox.test.tsx:23` - `toEqual([])` for `""`; :24 for `"   "` | PASS |
| C20 | no match -> [] | `-t "matchOptions returns nothing when no option matches"` exit 0, ran | `web/src/components/ui/combobox.test.tsx:28` - `expect(matchOptions(["Voolt"], "xyz", 8)).toEqual([])` | PASS |
| C21 | typing `a` opens list with 3D Fila, Bambu Lab in order | `-t "suggests brands containing the typed letter"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:476` - `expect(optionNames()).toEqual(["3D Fila", "Bambu Lab"])`; :475 `aria-expanded` `"true"` | PASS |
| C22 | empty field -> aria-expanded false, no listbox, also after clearing | `-t "brand list stays closed while the field is empty"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:488` - `getAttribute("aria-expanded")).toBe("false")`; :489 `queryByRole("listbox")).toBeNull()` (initial at :482-483) | PASS |
| C23 | ACAO suggests Ação 3D | `-t "suggests brands ignoring case and accents"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:497` - `expect(optionNames()).toEqual(["Ação 3D"])` | PASS |
| C24 | 10 matches -> exactly the first 8 | `-t "shows at most 8 brand suggestions"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:506` - `toEqual(["Marca 01", ..., "Marca 08"])` | PASS |
| C25 | xyz -> closed, no listbox, no message | `-t "brand list stays closed when nothing matches"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:514` - `aria-expanded` `toBe("false")`; :515 listbox `toBeNull()`; :516 `queryByText(/nenhuma/i)).toBeNull()` | PASS |
| C26 | click Bambu Lab fills field and closes | `-t "clicking a suggestion fills the brand"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:525` - `expect(brandBox().value).toBe("Bambu Lab")`; :526 `aria-expanded` `"false"` | PASS |
| C27 | ArrowDown+Enter picks first, closes, no POST | `-t "ArrowDown and Enter pick a suggestion without submitting"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:536` - `expect(fireEvent.keyDown(brandBox(), { key: "Enter" })).toBe(false)`; :538 `toBe("3D Fila")`; :540 `postsOf(fetchMock)).toHaveLength(0)` | PASS |
| C28 | Escape closes and keeps text | `-t "Escape closes the brand list and keeps the text"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:550` - `aria-expanded` `toBe("false")`; :551 `brandBox().value).toBe("Bam")` | PASS |
| C29 | ARIA combobox: name Marca, aria-controls = listbox id, options, activedescendant | `-t "brand combobox exposes the ARIA combobox pattern"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:561` - `getAttribute("aria-controls")).toBe(listbox.id)`; :567 `getAttribute("aria-activedescendant")).toBe(options[0].id)`; name via `getByRole("combobox", { name: "Marca" })` :349 | PASS |
| C30 | free new brand sent as typed | `-t "accepts a new brand typed freely"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:579` - `expect(bodyOf(...).brand).toBe("Marca Nova")` | PASS |
| C31 | edit form offers the same suggestions | `-t "edit form offers the same brand suggestions"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:589` - `expect(optionNames()).toEqual(["3D Fila", "Bambu Lab"])` | PASS |
| C32 | saved new brand joins suggestions without refetch | `-t "a saved new brand joins the suggestions"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:602` - `toEqual(["Marca Nova"])`; :603 `callsTo(fetchMock, "/materials/brands")).toHaveLength(1)` | PASS |
| C33 | brands failure: page renders, no alert, no list | `-t "brands failure keeps the page working without suggestions"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:613` - `queryByRole("alert")).toBeNull()`; :611-612 table/form present; :617-618 closed, no listbox | PASS |
| C34 | POST #FF8800 -> 201, #ff8800 in body and row | API batch `-t "POST stores colorHex in lowercase"` exit 0, ran | `api/test/materials.e2e-spec.ts:391` - `expect(response.body.colorHex).toBe('#ff8800')`; :390 `toBe(201)`; :392 stored `toBe('#ff8800')` | PASS |
| C35 | POST omitted or null -> 201 colorHex null | `-t "POST without colorHex or with null answers null"` exit 0, ran | `api/test/materials.e2e-spec.ts:398` - `omitted.body.colorHex).toBeNull()`; :403 `explicitNull.body.colorHex).toBeNull()`; :397/:402 `toBe(201)` | PASS |
| C36 | 6 invalid values -> 400 with format error, nothing stored | `-t "POST rejects colorHex"` exit 0, ran x6 (`"#fff"`, `"ff8800"`, `"#gg0000"`, `"#ff88001"`, `""`, `123`) | `api/test/materials.e2e-spec.ts:411` - `expect(response.body).toEqual(INVALID_COLOR_HEX)` (literal at :378); :410 `toBe(400)`; :412 `countAll()).toBe(0)` | PASS |
| C37 | PATCH #00AA11 -> 200 #00aa11 | `-t "PATCH stores colorHex in lowercase"` exit 0, ran | `api/test/materials.e2e-spec.ts:421` - `expect(response.body.colorHex).toBe('#00aa11')`; :420 `toBe(200)` | PASS |
| C38 | PATCH null removes tone, row NULL | `-t "PATCH with colorHex null removes the tone"` exit 0, ran | `api/test/materials.e2e-spec.ts:431` - `response.body.colorHex).toBeNull()`; :432 `storedColorHex(id)).toBeNull()` | PASS |
| C39 | PATCH without colorHex keeps #ff8800 | `-t "PATCH without colorHex keeps the tone"` exit 0, ran | `api/test/materials.e2e-spec.ts:442` - `expect(response.body.colorHex).toBe('#ff8800')` | PASS |
| C40 | PATCH #ff88 -> 400 format error, row keeps #ff8800 | `-t "PATCH rejects an invalid colorHex and keeps the tone"` exit 0, ran | `api/test/materials.e2e-spec.ts:452` - `toEqual(INVALID_COLOR_HEX)`; :451 `toBe(400)`; :453 `storedColorHex(id)).toBe('#ff8800')` | PASS |
| C41 | GET /materials items carry colorHex value / null | `-t "GET /materials includes colorHex on each item"` exit 0, ran | `api/test/materials.e2e-spec.ts:463` - `toEqual([['hex-a-toned', '#ff8800'], ['hex-b-plain', null]])` | PASS |
| C42 | POST still 403 for production/sales, 401 without session | `-t "non-admin roles get 403 on POST /materials"` + `-t "POST /materials without a session is 401"` exit 0, both ran | `api/test/materials.e2e-spec.ts:146` - `expect(response.status).toBe(403)`; :154 `expect(response.status).toBe(401)` | PASS |
| C43 | PATCH still 403 / 401 / 404 | `-t "non-admin roles get 403 on PATCH /materials"`, `"PATCH /materials without a session is 401"`, `"PATCH with an unknown id is 404"` exit 0, all ran | `api/test/materials.e2e-spec.ts:337` - `toBe(403)`; :345 `toBe(401)`; :274 `toBe(404)` | PASS |
| C44 | GET /materials still 400 for bad page/pageSize, 401 without session | `-t "rejects invalid page and pageSize"` + `-t "GET /materials without a session is 401"` exit 0, both ran | `api/test/materials.e2e-spec.ts:230` - `expect(response.status).toBe(400)`; :236 `toBe(401)` | PASS |
| C45 | down() drops color_hex and keeps seeded rows | `-t "down keeps the seeded rows and drops color_hex"` exit 0, ran | `api/test/color-hex-migration.e2e-spec.ts:99` - `expect(await colorHexColumn()).toEqual([])`; :100 `toEqual(expectedRows())` (literal rows at :71-94) | PASS |
| C46 | up() recreates nullable varchar(7), no default, rows NULL | `-t "up recreates color_hex as nullable with NULL on existing rows"` exit 0, ran | `api/test/color-hex-migration.e2e-spec.ts:106` - `toEqual([{ is_nullable: 'YES', character_maximum_length: 7, column_default: null }])`; :107 rows `color_hex: null` | PASS |
| C47 | new form: "Escolher tom" swatch without colour, no Remover | web batch `-t "new form starts without a tone"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:627` - `expect(swatch().style.background).toBe("")`; :626 `bf-swatch--none`; :628 Remover `toBeNull()` | PASS |
| C48 | input type=color named Tom, swatch is its label | `-t "the swatch labels a color input named Tom"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:637` - `expect((swatch() as HTMLLabelElement).htmlFor).toBe(tone.id)`; :635 `tone.type).toBe("color")`; :636 `tagName).toBe("LABEL")` | PASS |
| C49 | picking #ff8800 paints swatch, shows Remover, sends it | `-t "picking a tone paints the swatch and sends it"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:646` - `style.background).toBe("rgb(255, 136, 0)")`; :648 Remover; :652 `colorHex).toBe("#ff8800")` | PASS |
| C50 | Remover returns to no tone, hides Remover, sends null | `-t "Remover returns to no tone and sends null"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:668` - `expect(bodyOf(...).colorHex).toBeNull()`; :662-664 swatch none, background `""`, Remover `toBeNull()` | PASS |
| C51 | edit shows stored tone + Remover; null shows none, no Remover | `-t "edit form shows the stored tone"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:681` - `toBe("rgb(255, 136, 0)")`; :683 Remover; :685 `bf-swatch--none`; :686 Remover `toBeNull()` | PASS |
| C52 | table Cor cell has name and img "Tom #ff8800" | `-t "table shows the tone swatch beside the color name"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:700` - `within(colorCell).getByRole("img", { name: "Tom #ff8800" })`; :699 `textContent).toBe("Laranja")` | PASS |
| C53 | table Cor cell without tone has only the name | `-t "table shows only the color name without a tone"` exit 0, ran | `web/src/app/(app)/materials/page.test.tsx:710` - `within(colorCell).queryByRole("img")).toBeNull()`; :709 `toBe("Natural")` | PASS |
| C54 | web compiles with nullable string `colorHex` on Material | `npm --prefix web run build` exit 0 | `web/src/lib/materials.ts:14` - `colorHex: string or null` field, compiled by `next build` | PASS |
| C55 | API compiles with colorHex in entity, DTOs, MaterialResponse | `npm --prefix api run build` exit 0 | `api/src/modules/materials/materials.types.ts:16` - `colorHex: string or null` field, compiled by `nest build` | PASS |
| C56 | CONTEXT.md defines Cor, Tom, Marca | grep chain from checks.md exit 0 | `CONTEXT.md:23` - `**Cor:**`; :24 `**Tom:**`; :25 `**Marca:**` | PASS |
| C57 | STATE.md has AD-032 active | AD-032 grep from checks.md exit 0 | `.specs/STATE.md:38` - row `AD-032` with status `active` | PASS |

## Level and sampling

- Claims naming a status, route or response shape (C7, C8, C9, C15, C34-C44) are all asserted in e2e tests that cross HTTP via supertest. No level gap.
- `listBrands` decides and is route-reached: route contract C9 plus one direct service case per decision row C10-C15. `matchOptions` is pure: one case per row in `combobox.test.tsx`. Matches the `AGENTS.md` test policy.
- Limits carry both sides: C18 (10 and 8 matches). C36 is table-driven over all 6 values and each case ran individually.
- C42-C44 resolve to tests that existed before the diff range. Their claims are explicitly "existing statuses continue", so re-running them at HEAD is the right proof.

## Swept existing re-read

- authorization (C42, C43, AD-018): `api/src/modules/materials/materials.controller.ts:27-35` - POST and PATCH have no `@Roles()` (admin only); new `brands` route at :21-22 has `@Roles('production', 'sales')` like `GET /materials` at :14. Present.
- observability (AD-001 global filter): `api/src/common/filters/all-exceptions.filter.ts` exists. Present.
- validation (C36, C40): `@Matches(COLOR_HEX_PATTERN, { message: INVALID_COLOR_HEX })` after `@Transform(lowercase)` in both DTOs. Present.
- idempotency and concurrency are `n/a` (user-approved policy); nothing to check in code.

## Notes (non-blocking)

- C25 "sem mensagem" is asserted only as `queryByText(/nenhuma/i)).toBeNull()` (`page.test.tsx:516`). That is a narrow probe for "no message", but listbox absence (:515) already excludes an in-list empty message.
- C54 has no runtime assertion by nature. The proof is the type check in `next build`, and `web/src/lib/materials.ts` is cited as the contract's location.

## Gate

- `npm --prefix api run test:e2e -- <BR> <MT> <MG> -t "<26-name alternation>" --reporter=verbose` - 33 passed, 0 failed (17 skipped by filter)
- `npm --prefix web run test -- <PAGE> <CB> -t "<31-name alternation>" --reporter=verbose` - 31 passed, 0 failed (13 skipped by filter)
- `npm --prefix api run test` - 168 passed, 0 failed
- `npm --prefix api run test:e2e` - 423 passed, 0 failed
- `npm --prefix web run test` - 298 passed, 0 failed
- `npm --prefix api run build` exit 0 · `npm --prefix web run build` exit 0
- `npm --prefix api run lint` exit 0 · `npm --prefix web run lint` exit 0
- C56/C57 greps exit 0
