# Fase 1 — Motor de preço (`pricing`) · verification

**Verdict**: PASS
**Profile**: light
**Diff range**: 955261c..f8b1c50c76594c34e3bd440decaaaa2fb317e1b1
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Read-only pass over the real tree. Working tree porcelain before: clean (empty). After: clean
(empty) apart from this file. `npm --prefix api run test:cov` rewrites the committed
`api/coverage/**` tree; it was restored with `git checkout -- api/coverage` and
`git clean -fdq api/coverage`, and the porcelain was re-confirmed empty. No `git stash` was used,
no source or test file was edited.

Profile is `light`, so fault injection did not run and no `## Faults injected`,
`## Binding sources` or `## Test policy rows` section is owed (`checks.md` carries no
`Test policy` section either). Everything the profile keeps did run: every proof at HEAD, each
named test shown individually as run and passed, one located `file:line` plus the settling
assertion per check, the level and sampling judgment, the `## Coverage` recompute against the
authority over each set, and the re-read of the `Swept … existing` row.

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | R1 `costs.materialCents` `1050` | unit batch, `R1 material cost` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:40` - `expect(service.calculate(r1()).costs.materialCents).toBe(1050)` | PASS |
| C2 | R1 `costs.energyCents` `100` | unit batch, `R1 energy cost` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:44` - `expect(service.calculate(r1()).costs.energyCents).toBe(100)` | PASS |
| C3 | R1 `costs.depreciationCents` `400` | unit batch, `R1 depreciation cost` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:48` - `expect(service.calculate(r1()).costs.depreciationCents).toBe(400)` | PASS |
| C4 | R1 `costs.maintenanceCents` `250` | unit batch, `R1 maintenance cost` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:52` - `expect(service.calculate(r1()).costs.maintenanceCents).toBe(250)` | PASS |
| C5 | R1 `costs.laborCents` `3000` | unit batch, `R1 labor cost` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:56` - `expect(service.calculate(r1()).costs.laborCents).toBe(3000)` | PASS |
| C6 | R1 `costs.suppliesCents` `300` | unit batch, `R1 supplies cost` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:60` - `expect(service.calculate(r1()).costs.suppliesCents).toBe(300)` | PASS |
| C7 | R1 `costs.fixedCostsCents` `1000` | unit batch, `R1 fixed costs` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:64` - `expect(service.calculate(r1()).costs.fixedCostsCents).toBe(1000)` | PASS |
| C8 | second material yields `materialCents` `1365` | unit batch, `multimaterial sums before purge` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:70` - `expect(service.calculate(input).costs.materialCents).toBe(1365)` (input built at :69 `input.materials.push({ grams: 20, costPerGramCents: 15 })`) | PASS |
| C9 | `supplies: []` yields `0`, other six unchanged | unit batch, `empty supplies cost zero` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:77` - `expect(costs.suppliesCents).toBe(0)`; the other six at `:78-83` (`toBe(1050)`, `toBe(100)`, `toBe(400)`, `toBe(250)`, `toBe(3000)`, `toBe(1000)`) | PASS |
| C10 | R1 `directCostCents` `6100` | unit batch, `R1 direct cost` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:89` - `expect(service.calculate(r1()).costs.directCostCents).toBe(6100)` | PASS |
| C11 | R1 `costWithRiskCents` `6710` | unit batch, `R1 cost with risk` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:93` - `expect(service.calculate(r1()).costs.costWithRiskCents).toBe(6710)` | PASS |
| C12 | `10485` Balcão · `13980` Mercado Livre | unit batch, `R1 unit price per channel` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:98-99` - `expect(channel(result, 'Balcão').unitPriceCents).toBe(10485)` and `expect(channel(result, 'Mercado Livre').unitPriceCents).toBe(13980)` | PASS |
| C13 | three entries, names `["C","A","B"]` in input order | unit batch, `channels keep input order` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:110` - `expect(result.channels.map((entry) => entry.name)).toEqual(['C', 'A', 'B'])` (settles count, order and name in one) | PASS |
| C14 | `totalPriceCents == unitPriceCents × quantity` for `1`, `3`, `10` | unit batch, `total is unit times quantity` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:119` - `expect(entry.totalPriceCents).toBe(entry.unitPriceCents * quantity)` inside the `for (const quantity of [1, 3, 10])` loop at `:114` | PASS |
| C15 | q=10 → `1650`, `4750`, `5225`, `8165`, `81650` | unit batch, `batch of 10 dilutes prep and slicing` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:128-132` - `toBe(1650)`, `toBe(4750)`, `toBe(5225)`, `toBe(8165)`, `toBe(81650)` | PASS |
| C16 | floor applied → `12000`, `12000`, `true` | unit batch, `minimum price raises a channel below the floor` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:141-143` - `expect(balcao.unitPriceCents).toBe(12000)`, `expect(balcao.totalPriceCents).toBe(12000)`, `expect(balcao.minimumPriceApplied).toBe(true)` | PASS |
| C17 | above floor `13980`/`false`; equal to floor `10485`/`false` | unit batch, `minimum price keeps a channel at or above the floor` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:150-151` - `expect(mercadoLivre.unitPriceCents).toBe(13980)` · `expect(mercadoLivre.minimumPriceApplied).toBe(false)`; equal branch at `:156-157` - `expect(balcao.unitPriceCents).toBe(10485)` · `toBe(false)` | PASS |
| C18 | q=3, floor `100000` → `33334`, `100002`, `true` | unit batch, `minimum price per unit rounds up` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:165-167` - `expect(balcao.unitPriceCents).toBe(33334)`, `expect(balcao.totalPriceCents).toBe(100002)`, `expect(balcao.minimumPriceApplied).toBe(true)` | PASS |
| C19 | every `*Cents` of `costs` and `channels` is an integer, over four inputs | unit batch, `every money field is an integer` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:182` - `expect(Number.isInteger(value)).toBe(true)` over `moneyFields(...)` for `[r1(), batch, tenth, floor]` at `:180`; `moneyFields` at `:25-28` spreads all nine `costs` values plus each channel's `unitPriceCents`/`totalPriceCents` | PASS |
| C20 | `materialCents` `347`; `roundCost(346.5)=347`, `(346.49)=346` | unit batch, `half cent rounds up` ✓ and `cost rounds half up` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:191` - `expect(service.calculate(input).costs.materialCents).toBe(347)`; `api/src/modules/pricing/rounding.spec.ts:5-6` - `expect(roundCost(346.5)).toBe(347)` · `expect(roundCost(346.49)).toBe(346)` | PASS |
| C21 | exact `10000`, not `10001`; `roundPriceUp` tolerates `1e-6` noise | unit batch, `exact price is not bumped` ✓ and `price rounds up tolerating float noise` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:199-200` - `expect(result.costs.costWithRiskCents).toBe(6400)` · `expect(channel(result, 'Balcão').unitPriceCents).toBe(10000)`; `api/src/modules/pricing/rounding.spec.ts:10-11` - `expect(roundPriceUp(10000.000000000002)).toBe(10000)` · `expect(roundPriceUp(10000.01)).toBe(10001)` | PASS |
| C22 | two `100.4` components → `100`, `100`, direct `201` | unit batch, `direct cost uses unrounded components` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:209-211` - `expect(costs.energyCents).toBe(100)`, `expect(costs.maintenanceCents).toBe(100)`, `expect(costs.directCostCents).toBe(201)` | PASS |
| C23 | no non-spec file but `rounding.ts` uses `Math.round/ceil/floor/trunc` or `toFixed` | shell proof verbatim from repo root, exit `0` | `api/src/modules/pricing/rounding.ts:9` - `return Math.round(cents);` and `:14` - `return Math.ceil(cents - PRICE_EPSILON);` are the only hits; the unfiltered `grep -rlE` lists `api/src/modules/pricing/rounding.ts` alone, so the exclusion is not vacuous | PASS |
| C24 | rates summing to `1` throw with the exact message; `0.19` does not | unit batch, `rates summing to 100% throw PricingError` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:221-224` - `expect(() => service.calculate(atLimit)).toThrow(PricingError)` · `.toThrow('Channel "Balcão": margin + taxes + fee must be below 100%')`; lower edge at `:230` - `expect(() => service.calculate(below)).not.toThrow()` | PASS |
| C25 | duplicate name throws with the exact message | unit batch, `duplicate channel name throws PricingError` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:239-240` - `expect(() => service.calculate(input)).toThrow(PricingError)` · `.toThrow('Duplicate channel name: "Balcão"')` | PASS |
| C26 | both errors are `PricingError`, never `HttpException`; service imports only `Injectable` | unit batch, `domain errors are not http exceptions` ✓ and shell proof verbatim, exit `0` | `api/src/modules/pricing/pricing.service.spec.ts:260-261` - `expect(thrown).toBeInstanceOf(PricingError)` · `expect(thrown).not.toBeInstanceOf(HttpException)`, looped over both inputs at `:253`; `api/src/modules/pricing/pricing.service.ts:1` - `import { Injectable } from '@nestjs/common';` is the file's only `@nestjs/common` import | PASS |
| C27 | `new PricingService()` works, equal inputs give equal results, input not mutated | unit batch, `pure and constructible without dependencies` ✓ | `api/src/modules/pricing/pricing.service.spec.ts:271-273` - `expect(first.costs.directCostCents).toBe(6100)`, `expect(second).toEqual(first)`, `expect(input).toEqual(before)`; construction at `:266` - `const fresh = new PricingService();` | PASS |
| C28 | each of the 22 numeric fields at `-1` → `400` naming the field | e2e batch, `negative numeric field returns 400` ✓ | `api/test/pricing.e2e-spec.ts:121-122` - `expect(response.status, path).toBe(400)` · `expect(errorOf(response), path).toContain(name)` inside the loop at `:118`; the arity is pinned at `:117` - `expect(numericFields).toHaveLength(22)` | PASS |
| C29 | `0`, `1.5`, `"abc"` → `400` naming `quantity`; `1` → `200` | e2e batch, `quantity must be a positive integer` ✓ | `api/test/pricing.e2e-spec.ts:129-130` - `expect(response.status, String(value)).toBe(400)` · `expect(errorOf(response)).toContain('quantity')`; positive case at `:132` - `expect((await post(withValue('quantity', 1))).status).toBe(200)` | PASS |
| C30 | zero divisors → `400` naming the field; `0.1` → `200` | e2e batch, `zero divisors return 400` ✓ | `api/test/pricing.e2e-spec.ts:138-140` - `expect(response.status, path).toBe(400)` · `expect(errorOf(response)).toContain(path.split('.').pop() as string)` · `expect((await post(withValue(path, 0.1))).status, path).toBe(200)` | PASS |
| C31 | `purgeRate`/`failureRate` `1.01` → `400`, `1` → `200`; `marginRate`/`taxRate`/`feeRate` `1` → `400` | e2e batch, `rate upper bounds` ✓ | `api/test/pricing.e2e-spec.ts:147-149` - `expect(over.status, path).toBe(400)` · `expect(errorOf(over)).toContain(path)` · `expect((await post(withValue(path, 1))).status, path).toBe(200)`; strict-below trio at `:153-154` - `expect(response.status, path).toBe(400)` · `toContain(path.split('.').pop() as string)` | PASS |
| C32 | `materials: []` and `channels: []` → `400` naming the field | e2e batch, `empty materials or channels return 400` ✓ | `api/test/pricing.e2e-spec.ts:161-162` - `expect(response.status, path).toBe(400)` · `expect(errorOf(response)).toContain(path)` over `['materials', 'channels']` at `:159` | PASS |
| C33 | 33/51/21 → `400` naming the field; 32/50/20 → `200` | e2e batch, `array size limits` ✓ | `api/test/pricing.e2e-spec.ts:178-180` - `expect(over.status, ...).toBe(400)` · `expect(errorOf(over)).toContain(path)` · `expect((await post(withValue(path, build(limit)))).status, ...).toBe(200)`; limits `32`, `50`, `20` fixed at `:172-174` | PASS |
| C34 | `""` and 61 chars → `400` naming `name`; 60 chars → `200` | e2e batch, `channel name length` ✓ | `api/test/pricing.e2e-spec.ts:187-188` - `expect(response.status, ...).toBe(400)` · `expect(errorOf(response)).toContain('name')`; upper edge at `:190` - `expect((await post(withValue('channels.0.name', 'a'.repeat(60)))).status).toBe(200)` | PASS |
| C35 | undeclared `extra` at root, in `printer`, in `materials[0]` → `400` with `should not exist` | e2e batch, `undeclared nested property returns 400` ✓ | `api/test/pricing.e2e-spec.ts:196-197` - `expect(response.status, path).toBe(400)` · `expect(errorOf(response), path).toContain('should not exist')` over `['extra', 'printer.extra', 'materials.0.extra']` at `:194` | PASS |
| C36 | R1 → `200` with the full literal body | e2e batch, `R1 returns the full breakdown` ✓ | `api/test/pricing.e2e-spec.ts:44` - `expect(response.status).toBe(200)` and `:45-67` - `expect(response.body).toEqual({ quantity: 1, costs: { materialCents: 1050, …, costWithRiskCents: 6710 }, channels: [{ name: 'Balcão', unitPriceCents: 10485, totalPriceCents: 10485, minimumPriceApplied: false }, { name: 'Mercado Livre', unitPriceCents: 13980, totalPriceCents: 13980, minimumPriceApplied: false }] })` | PASS |
| C37 | both domain errors → `400` with exactly `{ error: … }`; controller converts | e2e batch, `domain errors return 400` ✓ and unit batch, `PricingError becomes BadRequestException` ✓ | `api/test/pricing.e2e-spec.ts:76-79` - `expect(ratesResponse.status).toBe(400)` · `expect(ratesResponse.body).toEqual({ error: 'Channel "Balcão": margin + taxes + fee must be below 100%' })` and `:87-88` - `toBe(400)` · `toEqual({ error: 'Duplicate channel name: "Balcão"' })`; `api/src/modules/pricing/pricing.controller.spec.ts:26-28` - `expect(thrown).toBeInstanceOf(BadRequestException)` · `.getStatus()).toBe(400)` · `.message).toBe('Duplicate channel name: "Balcão"')` | PASS |
| C38 | `test:cov` exits `0`; exits non-zero with the pricing specs excluded | `npm --prefix api run test:cov` exit `0` (46 passed, 9 files) and `! npm --prefix api run test:cov -- --exclude 'src/modules/pricing/**'` exit `0` (negation held) | `api/vitest.config.ts:17` - `'src/modules/pricing/**': { lines: 95 }` under `coverage.thresholds`; positive run's table reports `src/modules/pricing` lines `95.34`, and `api/coverage/coverage-final.json` from that run keys all nine pricing sources (`pricing.service.ts`, `pricing.controller.ts`, `rounding.ts`, `pricing.error.ts`, `pricing.module.ts`, `pricing.types.ts`, `dto/calculate-pricing.dto.ts`, `dto/is-below-one.decorator.ts`, `fixtures/r1.ts`), so the table really measures that tree; negative run prints `ERROR: Coverage for lines (0%) does not meet "src/modules/pricing/**" threshold (95%)` | PASS |

Every named test in the two batches appeared individually as a `✓` line in the verbose output
(29 unit, 10 e2e); no filter silently matched nothing. All 39 named tests are new in this diff
range - none resolve to a pre-existing test.

## Coverage

Recomputed from the authority over each set, not read back from `checks.md`.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `POST /pricing/calculate` statuses (2) | plan `## Surface` (contract authority) | `200` C36 `api/test/pricing.e2e-spec.ts:44` · `400` C37 `api/test/pricing.e2e-spec.ts:76` | - |
| cost components (7) | `CostBreakdown` in `api/src/modules/pricing/pricing.types.ts:55-65` | material C1 · energy C2 · depreciation C3 · maintenance C4 · labor C5 · supplies C6 · fixedCosts C7 | - |
| cost aggregates (2) | `CostBreakdown` `:63-64` | `directCostCents` C10 · `costWithRiskCents` C11 | - |
| channel result fields (4) | `ChannelPrice` in `api/src/modules/pricing/pricing.types.ts:67-72` | `name` C13 · `unitPriceCents` C12 · `totalPriceCents` C14 · `minimumPriceApplied` C16 (true) and C17 (false); all four re-asserted at the boundary by C36 | - |
| `quantity` values (3) | plan AC 15, 18 | `1` C1 · `3` C18 · `10` C15 | - |
| minimum-price branches (3) | `priceChannel` in `api/src/modules/pricing/pricing.service.ts:87-90` | below floor C16 · at floor C17 · above floor C17 | - |
| rounding rules (4) | `api/src/modules/pricing/rounding.ts:8-15` plus plan door 2 | cost half-up C20 · price ceiling C12 · exact price not bumped C21 · aggregates from exact values C22 (and single-site rule C23) | - |
| domain errors (2) | `throw` sites in `api/src/modules/pricing/pricing.service.ts:68` and `:73-75` | rates ≥ 100% C24 · duplicate channel C25; both re-asserted at the boundary by C37 | - |
| rate-sum edges (2) | `MIN_DIVISOR` guard `api/src/modules/pricing/pricing.service.ts:71-76` | `1.0` throws C24 `:221-224` · `0.99` does not C24 `:230` | - |
| negative numeric fields (22) | every numeric property declared in `api/src/modules/pricing/dto/calculate-pricing.dto.ts` (23 total, less `quantity` which AC 29/C29 owns) | C28, table-driven over all 22, list at `api/test/pricing.e2e-spec.ts:91-114`, arity pinned at `:117`. Field-by-field the list matches the DTO exactly: root `printHours` `:107`, `energyTariffCentsPerKwh` `:122`, `maintenanceCentsPerHour` `:126`, `purgeRate` `:146`, `failureRate` `:151`, `marginRate` `:156`, `taxRate` `:161`, `minimumOrderCents` `:165`; `MaterialDto` `:29`, `:33`; `PrinterDto` `:40`, `:43`, `:48`; `LaborDto` `:54`, `:58`, `:62`, `:66`; `SupplyDto` `:72`, `:76`; `FixedCostsDto` `:82`, `:87`; `ChannelDto` `:98` | - |
| invalid `quantity` (3) | `@IsInt() @Min(1)` at `api/src/modules/pricing/dto/calculate-pricing.dto.ts:102-104` | `0` · `1.5` · `"abc"` all C29 `api/test/pricing.e2e-spec.ts:127-131`; `-1` is rejected by the same `@Min(1)` that `0` exercises | - |
| zero divisors (2) | the two `@IsPositive()` fields, `api/src/modules/pricing/dto/calculate-pricing.dto.ts:47` and `:86` | `printer.lifespanHours` C30 · `fixedCosts.productiveHoursPerMonth` C30 | - |
| rate upper bounds (5) | `@Max(1)` at `api/src/modules/pricing/dto/calculate-pricing.dto.ts:145` and `:150`; `@IsBelowOne()` at `:155`, `:160`, `:97` | `purgeRate` and `failureRate` (`1` ok, `1.01` rejected) C31 `api/test/pricing.e2e-spec.ts:146-149` · `marginRate`, `taxRate`, `feeRate` (`1` rejected) C31 `:151-155`. The split matches the code exactly: `@Max(1)` is inclusive, `@IsBelowOne` is strict (`api/src/modules/pricing/dto/is-below-one.decorator.ts:13`) | - |
| empty lists (2) | `@ArrayMinSize(1)` at `api/src/modules/pricing/dto/calculate-pricing.dto.ts:111` and `:168`; `supplies` deliberately has none (AC 9) | `materials` C32 · `channels` C32 | - |
| array limits, both edges each (3) | `@ArrayMaxSize` at `api/src/modules/pricing/dto/calculate-pricing.dto.ts:112` (32), `:134` (50), `:169` (20) | `materials` 32/33 · `supplies` 50/51 · `channels` 20/21, all C33 `api/test/pricing.e2e-spec.ts:172-181`; the literals `32`, `50`, `20` in the test match the three decorators one for one | - |
| undeclared property, per level (3) | `ValidationPipe({ forbidNonWhitelisted: true })` at `api/src/app.setup.ts:11` | root C35 · nested object `printer` C35 · list item `materials[0]` C35, `api/test/pricing.e2e-spec.ts:194` | - |
| one-way doors (4) | plan `## Landing` | 1 units C36, C19 · 2 rounding C20, C21, C22, C23 · 3 in-process contract C27 · 4 domain error C26, C37 | - |
| startup config: `PricingModule` mounted (1 assembly) | read directly, not via a test | `api/src/app.module.ts:19` - `PricingModule,` inside `imports`; that assembly is the one `main.ts` boots (`api/src/main.ts:6` - `NestFactory.create(AppModule)`) and the one the e2e boots (`api/test/pricing.e2e-spec.ts:27` - `Test.createTestingModule({ imports: [AppModule] })` plus `configureApp(app)` at `:29`, matching `api/src/main.ts:8`). One assembly, no second wiring | - |

**Level judgment.** Every claim naming a status code, a route or a response shape (C28–C37) has a
proof that crosses `POST /pricing/calculate` through a real HTTP request against an app booted
from `AppModule`. None of them rests only on a service- or DTO-level assertion. C37 additionally
carries a unit proof of the controller conversion, which supplements rather than substitutes.
C23, C26's second proof and C38 are shell/config claims with no boundary to cross. No level gaps.

**Sampling judgment.** Each claim about N cases is proven on N: C28 asserts `toHaveLength(22)`
before iterating, C14 loops all three quantities, C31 covers all five rate fields, C33 covers all
three arrays at both edges, C35 covers all three nesting levels, C19 covers the four inputs its
claim scopes itself to. No coverage gaps.

**Literal-value check.** Every expected number and message in the suite is a literal copied from
the plan's `## Criteria`, never recomputed with the code's formula: `1050`, `100`, `400`, `250`,
`3000`, `300`, `1000`, `1365`, `0`, `6100`, `6710`, `10485`, `13980`, `1650`, `4750`, `5225`,
`8165`, `81650`, `12000`, `33334`, `100002`, `347`, `346`, `10000`, `10001`, `201`, and the two
error strings, each matching AC 1–25 and 36–37 exactly. The one relational assertion is C14
(`totalPriceCents == unitPriceCents * quantity`), which is what AC 14 itself claims; its absolute
values are independently pinned by C15 (`81650`), C18 (`100002`) and C36 (`10485`, `13980`).

**R1 fixture.** `api/src/modules/pricing/fixtures/r1.ts:5-29` returns a `PricingInput` and nothing
else - no expected value, no derived number, no helper that computes one. Field by field it equals
the plan's R1 table (`quantity` 1, `printHours` 5, `materials` `[{100,10}]`, `printer`
`{250,400000,5000}`, tariff 80, maintenance 50, labor `{0.25,0.25,0.5,3000}`, supplies
`[{2,50},{1,200}]`, fixed costs `{60000,300}`, rates `0.05/0.1/0.3/0.06`, `minimumOrderCents` 0,
the two channels at `0` and `0.16`).

**Flow and Impact held true.** `api/src/modules/pricing/pricing.module.ts:5-9` declares only
`controllers`, `providers` and `exports` - no `imports`, so no `TypeOrmModule` and no database.
`api/src/app.module.ts:19` imports `PricingModule`. `api/vitest.config.ts:12-19` carries the
coverage block with the `lines: 95` threshold, and `test` (`vitest run`, `api/package.json:20`)
runs without `--coverage`, so the uncovered command is unchanged. No `web/` file and no entity or
migration appears in the diff range, matching the `web: nada` and `stored data: nada` rows.

**`Swept … existing` re-read.** The one `existing` row is `observability`. Its cited constraint is
there: `api/src/common/filters/all-exceptions.filter.ts:19-24` returns `{ error }` for an
`HttpException` without logging, and `:26-27` logs the stack (`this.logger.error('Unhandled
exception', stack)`) only for everything else. A `PricingError` converted to
`BadRequestException` therefore answers `400` and is not logged, exactly as the row states. The
other `Swept` rows are `n/a` policy the user approved, or point at C24–C35 which are proven above.

**Diff hygiene.** `grep -rnE '\.(skip|only|todo)\b|\bxit\(|\bxdescribe\('` over `api/src` and
`api/test` returns nothing: no test is skipped, focused or stubbed. `checks.md` changed only in
`f8b1c50`, and only by appending the three `## Handoff` lines (`Boundary`, `Settled mid-build`,
`Abandoned`) - no check was edited or weakened after the boundary. `.specs/STATE.md` gained
AD-006/007/008 and a new handoff block, which is the expected decision record. One artifact is
outside the plan: see gap 1.

## Gate

All commands run at `HEAD` = `f8b1c50`, from the repo root unless noted.

- Unit batch (from `api/`): `npx vitest run src/modules/pricing/pricing.service.spec.ts src/modules/pricing/rounding.spec.ts src/modules/pricing/pricing.controller.spec.ts --reporter=verbose -t "<29-name alternation covering C1-C22, C24-C27, C37>"` - **29 passed, 0 failed**, 3 files. Every one of the 29 names printed its own `✓` line.
- E2E batch (from `api/`): `npx vitest run --config ./vitest.config.e2e.ts test/pricing.e2e-spec.ts --reporter=verbose -t "<10-name alternation covering C28-C37>"` - **10 passed, 0 failed**, 1 file. Every one of the 10 names printed its own `✓` line.
- C23, verbatim: `test -z "$(grep -rlE 'Math\.(round|ceil|floor|trunc)|toFixed' api/src/modules/pricing --include='*.ts' --exclude='*.spec.ts' | grep -v '/rounding\.ts$')"` - **exit 0**.
- C26, verbatim: `test -z "$(grep -E "from '@nestjs/common'" api/src/modules/pricing/pricing.service.ts | grep -vE "^import \{ Injectable \} from '@nestjs/common';$")"` - **exit 0**.
- C38 positive, verbatim: `npm --prefix api run test:cov` - **exit 0**, 46 passed, 0 failed, 9 files; `src/modules/pricing` lines `95.34%` against the `95%` floor.
- C38 negative, verbatim: `! npm --prefix api run test:cov -- --exclude 'src/modules/pricing/**'` - **exit 0**, i.e. the underlying command exited non-zero with `ERROR: Coverage for lines (0%) does not meet "src/modules/pricing/**" threshold (95%)`.
- Full e2e suite: `npm --prefix api run test:e2e` - **21 passed, 0 failed**, 4 files.
- Repo conventions: `npm --prefix api run lint` - exit 0; `npm --prefix api run build` - exit 0.

## Gaps and risks

None blocks the verdict. Ranked.

1. **`api/coverage/**` is committed and is not ignored** - `api/coverage/index.html` and 25
   sibling files (~4,400 lines) entered the tree in this diff range. The plan's `## Impact` table
   names no such artifact, and `.gitignore` (lines 1-6) has no `coverage` entry. C38's own proof
   rewrites these files, so running the feature's own gate dirties the working tree. Recommend a
   follow-up that removes them from version control and ignores the directory. Not a check
   failure: no check claims anything about this path.
2. **AC 28 says "any numeric input"; the recomputed set is 23, the check's set is 22** -
   `api/src/modules/pricing/dto/calculate-pricing.dto.ts:102-104` declares `quantity` as the 23rd
   numeric field, and it is the one the C28 table omits. No behaviour is unproven: `-1` is
   rejected by the same `@Min(1)` decorator that C29 exercises with `0` at the boundary, asserting
   `400` and `error` containing `quantity` (`api/test/pricing.e2e-spec.ts:129-130`). This is a
   labelling narrowness in `checks.md`, not a coverage hole.
3. **C14 is the one relational assertion** - `api/src/modules/pricing/pricing.service.spec.ts:119`
   compares two values the code produced in the same call rather than a plan literal. AC 14 is
   itself stated as that invariant, so the check is faithful, and C15/C18/C36 pin the absolute
   numbers, so it cannot pass vacuously. Recorded as a precision note about the check's shape.

Under `light` no fault injection ran, so nothing here says whether these assertions would catch a
regression - only that they execute and assert the planned literals. That is the known cost of the
profile, not a defect of this build.
