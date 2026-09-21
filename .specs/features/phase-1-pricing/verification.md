# Fase 1 — Motor de preço (`pricing`) · verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 955261c..dca397ccc61bdd24dc851004b9e15d6e4e019706
**Round**: 2 - full
**Verifier**: independent sub-agent (author != verifier)

Round 1 was run under the `light` profile and passed; the user then raised `checks.md` to
`standard`, so this round re-runs every proof from scratch and adds the two steps `light` skips
(the recomputed `Coverage` join and fault injection). Nothing is carried forward.

Step 1 (binding sources) does not run: it is scoped to the `ui` profile, and this feature has no
design artifact — the plan marks no source binding.

Scope: every check C1–C38 over `955261c..HEAD`, run at `HEAD` = `dca397c`. Real tree
`git status --porcelain` was empty before and after this verification; nothing was edited but this
report.

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | R1 `materialCents` `1050` | `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts …` - `R1 material cost` passed | `api/src/modules/pricing/pricing.service.spec.ts:40` - `expect(service.calculate(r1()).costs.materialCents).toBe(1050)` | PASS |
| C2 | R1 `energyCents` `100` | same invocation - `R1 energy cost` passed | `api/src/modules/pricing/pricing.service.spec.ts:44` - `expect(service.calculate(r1()).costs.energyCents).toBe(100)` | PASS |
| C3 | R1 `depreciationCents` `400` | same invocation - `R1 depreciation cost` passed | `api/src/modules/pricing/pricing.service.spec.ts:48` - `expect(service.calculate(r1()).costs.depreciationCents).toBe(400)` | PASS |
| C4 | R1 `maintenanceCents` `250` | same invocation - `R1 maintenance cost` passed | `api/src/modules/pricing/pricing.service.spec.ts:52` - `expect(service.calculate(r1()).costs.maintenanceCents).toBe(250)` | PASS |
| C5 | R1 `laborCents` `3000` | same invocation - `R1 labor cost` passed | `api/src/modules/pricing/pricing.service.spec.ts:56` - `expect(service.calculate(r1()).costs.laborCents).toBe(3000)` | PASS |
| C6 | R1 `suppliesCents` `300` | same invocation - `R1 supplies cost` passed | `api/src/modules/pricing/pricing.service.spec.ts:60` - `expect(service.calculate(r1()).costs.suppliesCents).toBe(300)` | PASS |
| C7 | R1 `fixedCostsCents` `1000` | same invocation - `R1 fixed costs` passed | `api/src/modules/pricing/pricing.service.spec.ts:64` - `expect(service.calculate(r1()).costs.fixedCostsCents).toBe(1000)` | PASS |
| C8 | second material yields `materialCents` `1365` | same invocation - `multimaterial sums before purge` passed | `api/src/modules/pricing/pricing.service.spec.ts:70` - `expect(service.calculate(input).costs.materialCents).toBe(1365)`, with `input.materials.push({ grams: 20, costPerGramCents: 15 })` at `:69` | PASS |
| C9 | empty `supplies` gives `0`, other six unchanged | same invocation - `empty supplies cost zero` passed | `api/src/modules/pricing/pricing.service.spec.ts:77` - `expect(costs.suppliesCents).toBe(0)`; the other six at `:78-83` (`materialCents` 1050 … `fixedCostsCents` 1000) | PASS |
| C10 | R1 `directCostCents` `6100` | same invocation - `R1 direct cost` passed | `api/src/modules/pricing/pricing.service.spec.ts:89` - `expect(service.calculate(r1()).costs.directCostCents).toBe(6100)` | PASS |
| C11 | R1 `costWithRiskCents` `6710` | same invocation - `R1 cost with risk` passed | `api/src/modules/pricing/pricing.service.spec.ts:93` - `expect(service.calculate(r1()).costs.costWithRiskCents).toBe(6710)` | PASS |
| C12 | `unitPriceCents` `10485` / `13980` | same invocation - `R1 unit price per channel` passed | `api/src/modules/pricing/pricing.service.spec.ts:98-99` - `expect(channel(result, 'Balcão').unitPriceCents).toBe(10485)` and `expect(channel(result, 'Mercado Livre').unitPriceCents).toBe(13980)` | PASS |
| C13 | three channels returned in input order | same invocation - `channels keep input order` passed | `api/src/modules/pricing/pricing.service.spec.ts:110` - `expect(result.channels.map((entry) => entry.name)).toEqual(['C', 'A', 'B'])` | PASS |
| C14 | `totalPriceCents` = `unitPriceCents` × `quantity` for 1, 3, 10 | same invocation - `total is unit times quantity` passed | `api/src/modules/pricing/pricing.service.spec.ts:119` - `expect(entry.totalPriceCents).toBe(entry.unitPriceCents * quantity)`, loop over `[1, 3, 10]` at `:114` | PASS |
| C15 | `quantity` `10` dilutes prep and slicing | same invocation - `batch of 10 dilutes prep and slicing` passed | `api/src/modules/pricing/pricing.service.spec.ts:128-132` - `laborCents).toBe(1650)`, `directCostCents).toBe(4750)`, `costWithRiskCents).toBe(5225)`, `Balcão` `unitPriceCents).toBe(8165)`, `totalPriceCents).toBe(81650)` | PASS |
| C16 | floor raises `Balcão` to `12000`, flag `true` | same invocation - `minimum price raises a channel below the floor` passed | `api/src/modules/pricing/pricing.service.spec.ts:141-143` - `expect(balcao.unitPriceCents).toBe(12000)`, `expect(balcao.totalPriceCents).toBe(12000)`, `expect(balcao.minimumPriceApplied).toBe(true)` | PASS |
| C17 | above the floor and exactly at it both keep the calculated price, flag `false` | same invocation - `minimum price keeps a channel at or above the floor` passed | `api/src/modules/pricing/pricing.service.spec.ts:150-151` - `expect(mercadoLivre.unitPriceCents).toBe(13980)`, `expect(mercadoLivre.minimumPriceApplied).toBe(false)`; equal case `:156-157` - `expect(balcao.unitPriceCents).toBe(10485)`, `expect(balcao.minimumPriceApplied).toBe(false)` | PASS |
| C18 | `quantity` 3 with floor `100000` gives `33334` / `100002` | same invocation - `minimum price per unit rounds up` passed | `api/src/modules/pricing/pricing.service.spec.ts:165-167` - `expect(balcao.unitPriceCents).toBe(33334)`, `expect(balcao.totalPriceCents).toBe(100002)`, `expect(balcao.minimumPriceApplied).toBe(true)` | PASS |
| C19 | every `*Cents` field of `costs` and `channels` is an integer, over four inputs | same invocation - `every money field is an integer` passed | `api/src/modules/pricing/pricing.service.spec.ts:182` - `expect(Number.isInteger(value)).toBe(true)`, over the four inputs listed at `:180` and the field list built at `:25-28` | PASS |
| C20 | `materialCents` `347`; `roundCost` takes `346.5` to `347` and `346.49` to `346` | same invocation - `half cent rounds up` and `cost rounds half up` both passed | `api/src/modules/pricing/pricing.service.spec.ts:191` - `expect(service.calculate(input).costs.materialCents).toBe(347)`; `api/src/modules/pricing/rounding.spec.ts:5-6` - `expect(roundCost(346.5)).toBe(347)`, `expect(roundCost(346.49)).toBe(346)` | PASS |
| C21 | exact price is not bumped; `roundPriceUp` tolerates float noise | same invocation - `exact price is not bumped` and `price rounds up tolerating float noise` both passed | `api/src/modules/pricing/pricing.service.spec.ts:199-200` - `expect(result.costs.costWithRiskCents).toBe(6400)`, `expect(channel(result, 'Balcão').unitPriceCents).toBe(10000)`; `api/src/modules/pricing/rounding.spec.ts:10-11` - `expect(roundPriceUp(10000.000000000002)).toBe(10000)`, `expect(roundPriceUp(10000.01)).toBe(10001)` | PASS |
| C22 | two `100.4` components give `100`, `100` and `201` | same invocation - `direct cost uses unrounded components` passed | `api/src/modules/pricing/pricing.service.spec.ts:209-211` - `expect(costs.energyCents).toBe(100)`, `expect(costs.maintenanceCents).toBe(100)`, `expect(costs.directCostCents).toBe(201)` | PASS |
| C23 | only `rounding.ts` rounds | shell proof run verbatim, exit `0` | `api/src/modules/pricing/rounding.ts:9` - `return Math.round(cents)` and `:14` - `return Math.ceil(cents - PRICE_EPSILON)` are the sole hits; the grep's file list prints only `api/src/modules/pricing/rounding.ts` | PASS |
| C24 | rates summing to `1` throw with the exact message; `0.19` does not | same invocation - `rates summing to 100% throw PricingError` passed | `api/src/modules/pricing/pricing.service.spec.ts:221-224` - `expect(() => service.calculate(atLimit)).toThrow(PricingError)` and `.toThrow('Channel "Balcão": margin + taxes + fee must be below 100%')`; lower edge `:230` - `expect(() => service.calculate(below)).not.toThrow()` | PASS |
| C25 | duplicate channel name throws with the exact message | same invocation - `duplicate channel name throws PricingError` passed | `api/src/modules/pricing/pricing.service.spec.ts:239-240` - `expect(() => service.calculate(input)).toThrow(PricingError)` and `.toThrow('Duplicate channel name: "Balcão"')` | PASS |
| C26 | both domain errors are `PricingError`, never `HttpException`; the service imports only `Injectable` | same invocation - `domain errors are not http exceptions` passed; shell proof run verbatim, exit `0` | `api/src/modules/pricing/pricing.service.spec.ts:260-261` - `expect(thrown).toBeInstanceOf(PricingError)`, `expect(thrown).not.toBeInstanceOf(HttpException)`, over both inputs at `:253`; import at `api/src/modules/pricing/pricing.service.ts:1` - `import { Injectable } from '@nestjs/common';` is the only `@nestjs/common` line | PASS |
| C27 | constructible with no arguments, pure, input untouched | same invocation - `pure and constructible without dependencies` passed | `api/src/modules/pricing/pricing.service.spec.ts:266` - `const fresh = new PricingService();`; `:271-273` - `expect(first.costs.directCostCents).toBe(6100)`, `expect(second).toEqual(first)`, `expect(input).toEqual(before)` | PASS |
| C28 | all 22 numeric fields at `-1` give `400` naming the field | `npm --prefix api run test:e2e -- test/pricing.e2e-spec.ts …` - `negative numeric field returns 400` passed | `api/test/pricing.e2e-spec.ts:121-122` - `expect(response.status, path).toBe(400)` and `expect(errorOf(response), path).toContain(name)`, driven by the 22-entry list at `:91-114` whose size is pinned at `:117` by `expect(numericFields).toHaveLength(22)` | PASS |
| C29 | `0`, `1.5`, `"abc"` give `400` naming `quantity`; `1` gives `200` | same invocation - `quantity must be a positive integer` passed | `api/test/pricing.e2e-spec.ts:129-130` - `expect(response.status, String(value)).toBe(400)`, `expect(errorOf(response)).toContain('quantity')`; `:132` - `expect((await post(withValue('quantity', 1))).status).toBe(200)` | PASS |
| C30 | zero divisors give `400` naming the field; `0.1` gives `200` | same invocation - `zero divisors return 400` passed | `api/test/pricing.e2e-spec.ts:138-140` - `expect(response.status, path).toBe(400)`, `expect(errorOf(response)).toContain(path.split('.').pop() as string)`, `expect((await post(withValue(path, 0.1))).status, path).toBe(200)` over both paths at `:136` | PASS |
| C31 | `purgeRate`/`failureRate` `1.01` give `400` and `1` gives `200`; `marginRate`, `taxRate`, `feeRate` at `1` give `400` | same invocation - `rate upper bounds` passed | `api/test/pricing.e2e-spec.ts:147-149` - `expect(over.status, path).toBe(400)`, `expect(errorOf(over)).toContain(path)`, `expect((await post(withValue(path, 1))).status, path).toBe(200)`; the three `IsBelowOne` fields at `:153-154` - `expect(response.status, path).toBe(400)`, `expect(errorOf(response)).toContain(path.split('.').pop() as string)` | PASS |
| C32 | empty `materials` / `channels` give `400` naming the field | same invocation - `empty materials or channels return 400` passed | `api/test/pricing.e2e-spec.ts:161-162` - `expect(response.status, path).toBe(400)`, `expect(errorOf(response)).toContain(path)` over `['materials', 'channels']` at `:159` | PASS |
| C33 | 33 / 51 / 21 give `400`; 32 / 50 / 20 give `200` | same invocation - `array size limits` passed | `api/test/pricing.e2e-spec.ts:178-180` - `expect(over.status, ...).toBe(400)`, `expect(errorOf(over)).toContain(path)`, `expect((await post(withValue(path, build(limit)))).status, ...).toBe(200)`, over the three limits 32/50/20 at `:172-174` | PASS |
| C34 | `""` and 61 chars give `400` naming `name`; 60 chars gives `200` | same invocation - `channel name length` passed | `api/test/pricing.e2e-spec.ts:187-188` - `expect(response.status, ...).toBe(400)`, `expect(errorOf(response)).toContain('name')`; `:190` - `expect((await post(withValue('channels.0.name', 'a'.repeat(60)))).status).toBe(200)` | PASS |
| C35 | `extra` at root, in `printer` and in `materials[0]` gives `400` containing `should not exist` | same invocation - `undeclared nested property returns 400` passed | `api/test/pricing.e2e-spec.ts:196-197` - `expect(response.status, path).toBe(400)`, `expect(errorOf(response), path).toContain('should not exist')` over the three paths at `:194` | PASS |
| C36 | R1 over HTTP gives `200` with the full body | same invocation - `R1 returns the full breakdown` passed | `api/test/pricing.e2e-spec.ts:44` - `expect(response.status).toBe(200)`; `:45-67` - `expect(response.body).toEqual({ quantity: 1, costs: { materialCents: 1050, …, costWithRiskCents: 6710 }, channels: [{ name: 'Balcão', unitPriceCents: 10485, totalPriceCents: 10485, minimumPriceApplied: false }, { name: 'Mercado Livre', unitPriceCents: 13980, totalPriceCents: 13980, minimumPriceApplied: false }] })` | PASS |
| C37 | both domain errors come out as `400 { error }`; the controller does the conversion | same invocation - `domain errors return 400` passed; and `PricingError becomes BadRequestException` passed in the unit invocation | `api/test/pricing.e2e-spec.ts:76-79` - `expect(ratesResponse.status).toBe(400)`, `expect(ratesResponse.body).toEqual({ error: 'Channel "Balcão": margin + taxes + fee must be below 100%' })`; `:87-88` - `expect(duplicateResponse.body).toEqual({ error: 'Duplicate channel name: "Balcão"' })`; `api/src/modules/pricing/pricing.controller.spec.ts:26-28` - `expect(thrown).toBeInstanceOf(BadRequestException)`, `.getStatus()).toBe(400)`, `.message).toBe('Duplicate channel name: "Balcão"')` | PASS |
| C38 | `test:cov` passes whole, and the underlying command exits non-zero once the pricing specs are excluded | both shell proofs run verbatim: `npm --prefix api run test:cov` exit `0`; `! npm --prefix api run test:cov -- --exclude 'src/modules/pricing/**'` exit `0`, i.e. the inner command failed | `api/vitest.config.ts:16-18` - `thresholds: { 'src/modules/pricing/**': { lines: 95 } }`; direction 1 reported `src/modules/pricing` lines `95.34`; direction 2 printed `ERROR: Coverage for lines (0%) does not meet "src/modules/pricing/**" threshold (95%)` | PASS |

Level and sampling judgment (`checks.md` carries no `Test policy` rows, so the repo's own
conventions decide - see `## Test policy rows`):

- Every claim that names a status code, a route or a response shape (C28–C37) is settled by a
  proof that crosses the `POST /pricing/calculate` boundary in `api/test/pricing.e2e-spec.ts`,
  booting the real `AppModule` at `:27` with the real `configureApp` at `:29`. No level gap.
- C1–C22 and C27 claim service or pure-function behaviour and are proven at that layer. C24 and
  C25 claim `the pricing service SHALL throw`, so the service layer is the right level; C37
  re-asserts the same two messages at the boundary, and neither substitutes for the other.
- C23, the second proof of C26 and C38 are structural or command-level claims, and shell proofs
  are the matching level.
- Sampling: C28 is table-driven over all 22 members and pins its own size at `:117`; C31 covers
  all five rate-bounded fields; C33 covers both edges of all three arrays; C35 covers all three
  nesting levels. C19 is explicitly scoped by `checks.md` to the four inputs its proof builds,
  and the proof builds exactly those four (`pricing.service.spec.ts:180`).
- Precision gap (checks, not code): `checks.md` C28 fixes the set at 22 numeric fields while the
  DTO declares 23 (`quantity` included), and neither the check nor the `Coverage` row says that
  `quantity` is delegated to C29. See `## Coverage`.

`Swept` rows resolving to `existing`, re-read against the code:

- `observability: existing` - confirmed. `api/src/common/filters/all-exceptions.filter.ts:19-23`
  returns for any `HttpException` before reaching the logger, and `:26-27`
  (`this.logger.error('Unhandled exception', stack)`) runs only for everything else. A
  `PricingError` converted to `BadRequestException` is therefore answered `400` and not logged,
  exactly as the row claims.
- The plan's `Flow` marks the `ValidationPipe` `(exists)` - confirmed at
  `api/src/app.setup.ts:8-14`, with `whitelist`, `forbidNonWhitelisted` and `transform` all on,
  which is what C35 leans on.
- Rows reading `n/a` (authorization, concurrency, data lifecycle, dependency failure, state
  transitions) are approved policy; there is nothing in the code for them to be wrong about.

## Coverage

Recomputed from the authority over each set, not read back from the author's table. `Recomputed
from` names that authority.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `POST /pricing/calculate` statuses (2) | plan `Surface` row, which fixes `200`, `400` | `200` C36 (`pricing.e2e-spec.ts:44`) · `400` C37 (`:76`, `:87`) and C28–C35 | - |
| cost components (7) | plan AC 1–7 formulas | material C1 · energy C2 · depreciation C3 · maintenance C4 · labor C5 · supplies C6 · fixedCosts C7, each a literal `toBe` at `pricing.service.spec.ts:40-64` | - |
| cost aggregates (2) | plan AC 10–11 | `directCostCents` C10 (`:89`) · `costWithRiskCents` C11 (`:93`) | - |
| `CostBreakdown` fields (9) | `pricing.types.ts:55-65` | the 7 components above plus the 2 aggregates; all nine also pinned together by C36's whole-body `toEqual` at `pricing.e2e-spec.ts:46-57` | - |
| `ChannelPrice` fields (4) | `pricing.types.ts:67-72` | `name` C13 (`:110`) · `unitPriceCents` C12 (`:98-99`) · `totalPriceCents` C14 (`:119`) · `minimumPriceApplied` C16 `true` (`:143`) and C17 `false` (`:151`, `:157`) | - |
| `PricingResult` top-level fields (3) | `pricing.types.ts:74-78` | `quantity`, `costs`, `channels` all fixed by C36's `expect(response.body).toEqual({...})` at `pricing.e2e-spec.ts:45-67`, which is exact and would reject an extra or missing key. No row existed for this set in `checks.md` | - |
| `quantity` values (3) | plan AC 15, 18 and the R1 case | `1` C1/C36 · `3` C18 (`:161`) · `10` C15 (`:126`) | - |
| minimum-price branches (3) | the branch at `pricing.service.ts:87` (`calculatedUnitCents * quantity < minimumOrderCents`) | below C16 (`:141-143`) · exactly at C17 (`:156-157`) · above C17 (`:150-151`) | - |
| rounding rules (4) | plan door 2 and `rounding.ts:8-15` | cost half-up C20 · price ceiling C12 · exact price not bumped C21 · aggregates built from exact values C22 (`:209-211`); the single-function rule C23 | - |
| domain errors (2) | the two `throw` sites at `pricing.service.ts:68` and `:73-75` | duplicate name C25 (`:239-240`) · rate sum C24 (`:221-224`). These are the only two `throw` statements in the module | - |
| rate-sum edges (2) | plan AC 24 | `1` throws C24 (`:221-224`) · `0.99` does not C24 (`:230`) | - |
| negative numeric fields (22 asserted / 23 declared) | the `@IsNumber` + `@Min(0)` / `@IsPositive` / `@IsInt` decorators in `calculate-pricing.dto.ts` and its nested DTOs | all 22 in the C28 list -> C28, table-driven, `pricing.e2e-spec.ts:121-122`. The 23rd declared numeric field, `quantity`, is guarded by `@Min(1)` at `calculate-pricing.dto.ts:103`, a strictly tighter bound, and that decorator is asserted by C29 with `quantity: 0` at `pricing.e2e-spec.ts:129-130` | - |
| invalid `quantity` (3) | plan AC 29 | `0`, `1.5`, `"abc"` all C29, loop at `pricing.e2e-spec.ts:127`; accepting side `1` -> `200` at `:132` | - |
| zero divisors (2) | the two `@IsPositive()` decorators, `calculate-pricing.dto.ts:47` and `:86` - the only two in the DTO set | `lifespanHours` C30 · `productiveHoursPerMonth` C30, both at `pricing.e2e-spec.ts:138-140` | - |
| rate upper bounds (5) | the `@Max(1)` decorators at `calculate-pricing.dto.ts:145`, `:150` and the `@IsBelowOne()` at `:97`, `:155`, `:160` - the complete set of rate-bounded fields | `purgeRate` C31 · `failureRate` C31 (`:147-149`) · `marginRate` C31 · `taxRate` C31 · `feeRate` C31 (`:153-154`) | - |
| `IsBelowOne` semantics (2 edges) | `is-below-one.decorator.ts:13` - `value < 1` | at `1` rejected C31 (`pricing.e2e-spec.ts:153-154`) · below `1` accepted C36, whose R1 carries `marginRate` `0.3` and `feeRate` `0.16` and gets `200` at `:44` | - |
| empty lists (2) | the two `@ArrayMinSize(1)` decorators, `calculate-pricing.dto.ts:111` and `:168`; `supplies` has none, which is why C9 exists | `materials` C32 · `channels` C32 (`pricing.e2e-spec.ts:161-162`); `supplies` empty is allowed and returns `0`, C9 (`pricing.service.spec.ts:77`) | - |
| array size limits, both edges each (3) | the three `@ArrayMaxSize` decorators, `calculate-pricing.dto.ts:112` (32), `:134` (50), `:169` (20) | `materials` 32/33 · `supplies` 50/51 · `channels` 20/21, all C33, `pricing.e2e-spec.ts:178-180` | - |
| channel name bounds (3) | `@IsString()` + `@Length(1, 60)` at `calculate-pricing.dto.ts:91-92` | `""` C34 · 61 chars C34 (`:187-188`) · 60 chars accepted C34 (`:190`) | - |
| undeclared property, per level (3) | the `ValidationPipe` `forbidNonWhitelisted` at `app.setup.ts:11` plus the `@ValidateNested` sites | root C35 · nested object `printer` C35 · list item `materials[0]` C35, all at `pricing.e2e-spec.ts:196-197` | - |
| one-way doors (4) | plan `Landing` | 1 units of the contract C36 (integer cents in the exact body), C19 · 2 rounding C20, C21, C22, C23 · 3 in-process contract C27, plus `calculate-pricing.dto.ts:101` declaring `implements PricingInput`, type-checked by `npm --prefix api run build` (exit `0`) · 4 domain error C26, C37 | - |
| `test:cov` exit codes (2) | plan `Observable`, row `command test:cov`. No row existed for this set in `checks.md` | exit `0` on the full suite C38 direction 1 · exit non-zero below the floor C38 direction 2, both run here and both as claimed | - |
| startup config: `PricingModule` mounted (1 assembly) | the assembly file itself, read directly: `api/src/app.module.ts:19` - `PricingModule,` inside `imports` | the same assembly is what production boots (`api/src/main.ts:6` - `NestFactory.create(AppModule)`, with `configureApp(app)` at `:8`) and what the e2e boots (`pricing.e2e-spec.ts:27` - `Test.createTestingModule({ imports: [AppModule] })`, `configureApp(app)` at `:29`). The e2e does not assemble a bespoke module, so C36 is evidence about the real assembly | - |

Sweep for enumerations with no row at all: two were found and are recomputed above -
`PricingResult` top-level fields and `test:cov` exit codes. Both turned out fully proven, so they
are missing rows in `checks.md`, not coverage gaps. Nothing else in the plan's `Impact`,
`Surface`, `Relations`, `Landing` or `Observable` names a set without a proof. The plan's
`Assumptions` row `printHours igual a 0` states a behaviour with no acceptance criterion behind
it and therefore owes no check; it is recorded here only so the next round does not re-derive it.

On the 22-vs-23 question the brief raises: `quantity` is a declared numeric field, and no proof
sends it `-1`. It is not rated an unproven member, because the authority over "negative
`quantity`" is the `@Min(1)` decorator at `calculate-pricing.dto.ts:103`, and C29 asserts that
decorator at `quantity: 0` - a value inside the same rejected region and closer to the bound than
`-1`. Nothing a negative could exercise is left untested. What is genuinely wrong is the
artifact: the checks name a set of 22 without saying where the 23rd went. That is a precision gap
in `checks.md`, ranked lowest, and it is the only finding in this round.

## Test policy rows

`checks.md` carries no `## Test policy` section, so there are no rows to give a verdict on, and
`validate_checks.py` warns about exactly that. Per `verify.md`, the repo's own convention then
decides - and it does answer both questions this feature needed answered.

Which level proves this code: the `health` module is the precedent and it splits cleanly. Pure
logic is proven by constructing the class directly with no Nest container
(`api/src/modules/health/health.service.spec.ts:6-9` - `new HealthService({ query } as unknown as
DataSource)`); anything that decides a status code is proven through a controller or over HTTP
(`api/src/modules/health/health.controller.spec.ts:32-33` - `expect((error as
HttpException).getStatus()).toBe(503)`), and anything that is a route contract is proven against
the real `AppModule` in `api/test/*.e2e-spec.ts` (`api/test/health.e2e-spec.ts:15-16` -
`Test.createTestingModule({ imports: [AppModule] })`). The pricing work follows that split
exactly: `new PricingService()` for the maths, `pricing.controller.spec.ts` for the
`PricingError` to `400` conversion, `pricing.e2e-spec.ts` for every status claim.

How much of the input space must be asserted: the repo's convention is enumerate-the-set, not
sample-it. `api/test/errors.e2e-spec.ts:88-93` asserts all four error statuses in one array
rather than picking one, and `api/src/common/filters/all-exceptions.filter.spec.ts:41-47` runs
the filter over all five exception shapes. The pricing checks meet that bar or exceed it: C28 is
table-driven over 22 fields and pins its own size, C33 covers both edges of all three arrays, and
the coverage floor at `api/vitest.config.ts:16-18` makes it mechanical.

Conclusion: no rows to judge, and the repo's conventions do answer both questions concretely
enough to measure this build against. This is not recorded as a finding.

## Faults injected

Isolated in a scratch `git worktree` at `HEAD` under the session scratchpad, outside the repo,
with `api/node_modules` symlinked in. `git stash` was never used. The real tree's
`git status --porcelain` was empty before the run and empty after
`git worktree remove --force` plus `git worktree prune`; `HEAD` is still `dca397c`. The scratch
was restored with `git checkout -- .` between mutants, and its porcelain was empty at the end.

One fault per distinct assertion surface, five in total, each chosen so a different proof has to
fail.

| Mutation | Location | Killed | Proof that failed |
| --- | --- | --- | --- |
| dropped the float-noise tolerance: `Math.ceil(cents - PRICE_EPSILON)` -> `Math.ceil(cents)` | `api/src/modules/pricing/rounding.ts:14` | yes | C21 second proof - `rounding.spec.ts` `price rounds up tolerating float noise`, exit 1 |
| flipped the minimum-price branch `<` -> `<=` | `api/src/modules/pricing/pricing.service.ts:87` | yes | C17 - `pricing.service.spec.ts` `minimum price keeps a channel at or above the floor`, exit 1, `expected true to be false` |
| built the direct cost from the rounded components instead of the exact ones | `api/src/modules/pricing/pricing.service.ts:36` | yes | C22 - `pricing.service.spec.ts` `direct cost uses unrounded components`, exit 1, `expected 200 to be 201` |
| diluted `postProcessingHours` by `quantity` along with prep and slicing | `api/src/modules/pricing/pricing.service.ts:24-27` | yes | C15 - `pricing.service.spec.ts` `batch of 10 dilutes prep and slicing`, exit 1, `expected 300 to be 1650` |
| array bound off by one: `@ArrayMaxSize(50)` -> `@ArrayMaxSize(51)` on `supplies` | `api/src/modules/pricing/dto/calculate-pricing.dto.ts:134` | yes | C33 - `pricing.e2e-spec.ts` `array size limits`, exit 1, `supplies 51: expected 200 to be 400` |

Five injected, five killed, no survivors. The two surfaces the later phases lean on hardest - the
rounding policy and the per-unit minimum-price branch - were attacked first and both died to the
narrowest covering proof, so neither would pass under the plausible wrong implementation.

## Gate

All proofs run at `HEAD` = `dca397c`, batched per target, with every named test shown
individually in the runner output.

- `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts src/modules/pricing/rounding.spec.ts src/modules/pricing/pricing.controller.spec.ts src/modules/pricing/dto/calculate-pricing.dto.spec.ts --reporter=verbose` - 36 passed, 0 failed (4 files)
- `npm --prefix api run test:e2e -- test/pricing.e2e-spec.ts --reporter=verbose` - 10 passed, 0 failed (1 file)
- C23 shell proof, verbatim - exit 0
- C26 second shell proof, verbatim - exit 0
- `npm --prefix api run test:cov` - 46 passed, 0 failed (9 files), exit 0; `src/modules/pricing` lines 95.34% against the 95% floor
- `! npm --prefix api run test:cov -- --exclude 'src/modules/pricing/**'` - exit 0, the inner command having exited non-zero on `ERROR: Coverage for lines (0%) does not meet "src/modules/pricing/**" threshold (95%)`
- `npm --prefix api run lint` - exit 0 · `npm --prefix api run build` - exit 0 (the latter type-checks `CalculatePricingDto implements PricingInput`, door 3)

Note, not a finding: the pricing floor clears by 0.34 points. A single uncovered line in the
module would trip C38, which is the gate working, but it leaves the next phase almost no slack.
