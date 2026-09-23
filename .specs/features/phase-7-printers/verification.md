# Fase 7 — Impressoras verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: `5a299e8..HEAD` (`9a6ec13` feat(api), `538bf25` feat(web), `50848ca` docs)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `ROADMAP.md`, Fase 7 (Tarefas, Critérios de aceite) | yes | none | - |
| `ROADMAP.md`, "Matriz de permissões" (`printers` row) | yes | none | - |
| `api/src/modules/pricing/pricing.types.ts` (`PrinterInput`) | yes | none | - |
| `.specs/STATE.md` AD-006, AD-014, AD-018, AD-020, AD-021 | yes | none | - |
| `.specs/features/phase-6-materials/plan.md` (CRUD pattern precedent) | yes | none | - |

Step 1 comparison: the Matriz de permissões row (`admin: x`, `production: leitura + PATCH
/printers/:id/hourmeter`, `sales: leitura`) matches `printers.controller.ts` exactly - `list()`
carries `@Roles('production','sales')` (admin passes by default, AD-018), `create()`/`update()`
carry no `@Roles()` (admin-only by default), `adjustHourmeter()` carries `@Roles('production')`
only. `PrinterInput` in `pricing.types.ts` (`powerWatts`, `costCents`, `lifespanHours`) matches
`toPricingPrinterInput` field-for-field with no renaming or conversion. The web screen's controls
(create/edit/deactivate/reactivate gated to `editable`, hourmeter gated to
`canAdjustHourmeter`), states (loading/error/empty) and menu item all match the plan's `Surface`/
`Observable`/`Landing` tables. No contradiction found; no design element without a check.

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | POST without AMS -> 201, hourmeterHours 0, amsSlots null, active true | `test:e2e -t "creates a printer without AMS..."` exit 0 | `api/test/printers.e2e-spec.ts:88-97` - `expect(response.status).toBe(201)`, `toMatchObject({..., hourmeterHours: 0, amsSlots: null, active: true})` | PASS |
| C2 | POST with AMS -> amsSlots persisted | same file, `-t "creates a printer with AMS..."` | `:102-104` - `expect(response.body.amsSlots).toBe(4)` | PASS |
| C3 | explicit hourmeterHours persisted | `-t "persists an explicit hourmeterHours..."` | `:109-110` - `expect(response.body.hourmeterHours).toBe(120.5)` | PASS |
| C4 | 5 out-of-range cases -> 400, nothing persisted | `-t "rejects out-of-range cost, lifespan and power fields"` | `:113-125` - loop `expect(response.status).toBe(400)`, `expect(await countAll()).toBe(0)` | PASS |
| C5 | empty/blank name -> 400 | `-t "rejects an empty or blank name"` | `:128-134` | PASS |
| C6 | 5 nozzles out-of-bounds cases -> 400 | `-t "rejects an out-of-bounds nozzles list"` | `:137-149` | PASS |
| C7 | amsSlots missing/0 when hasAms=true -> 400 | `-t "requires amsSlots when hasAms is true"` | `:152-161` | PASS |
| C8 | amsSlots ignored/null when hasAms=false | `-t "ignores amsSlots when hasAms is false"` | `:164-167` - `expect(response.body.amsSlots).toBeNull()` | PASS |
| C9 | negative hourmeterHours on create -> 400 | `-t "rejects a negative hourmeterHours on create"` | `:170-173` | PASS |
| C10 | non-admin -> 403 on POST | `-t "non-admin roles get 403 on POST /printers"` | `:176-182` | PASS |
| C11 | no session -> 401 on POST | `-t "POST /printers without a session is 401"` | `:185-189` | PASS |
| C12 | GET no params -> 200, `{items,total:3,page:1,pageSize:20}`, ordered by name, all 3 roles | `-t "GET /printers returns the first page for every role..."` | `:194-210` - `expect(...items.map).toEqual(['m12-a','m12-b','m12-c'])` per role loop | PASS |
| C13 | search ignoring case | `-t "searches by name ignoring case"` | `:213-224` | PASS |
| C14 | filter by hasAms | `-t "filters by hasAms"` | `:227-234` | PASS |
| C15 | page/pageSize pagination | `-t "paginates with page and pageSize"` | `:237-253` | PASS |
| C16 | invalid page/pageSize -> 400 (3 cases) | `-t "rejects invalid page and pageSize"` | `:256-261` | PASS |
| C17 | no session -> 401 on GET | `-t "GET /printers without a session is 401"` | `:264-267` | PASS |
| C18 | PATCH persists only sent fields | `-t "PATCH persists only the sent fields"` | `:272-287` | PASS |
| C19 | unknown id -> 404 | `-t "PATCH with an unknown id is 404"` | `:290-293` | PASS |
| C20 | 10 invalid-field cases on PATCH -> 400, record unchanged | `-t "rejects invalid fields on PATCH without changing the record"` | `:296-336` - loop `expect(...).toBe(400)` then DB row equality check | PASS |
| C21 | hourmeterHours key on general PATCH -> 400, unchanged | `-t "rejects hourmeterHours on the general PATCH"` | `:339-349` | PASS |
| C22 | non-admin -> 403 on PATCH | `-t "non-admin roles get 403 on PATCH /printers"` | `:352-358` | PASS |
| C23 | no session -> 401 on PATCH | `-t "PATCH /printers without a session is 401"` | `:361-365` | PASS |
| C24 | deactivate -> active:false, row kept | `-t "deactivates a printer without deleting it"` | `:370-378` | PASS |
| C25 | reactivate -> active:true | `-t "reactivates an inactive printer"` | `:381-386` | PASS |
| C26 | DELETE /printers/:id -> 404 (no route) | `-t "DELETE /printers/:id does not exist"` | `:389-392` | PASS |
| C27 | admin+production set absolute hourmeter | `-t "admin and production set an absolute hourmeterHours"` | `:397-403` | PASS |
| C28 | negative/missing hourmeterHours -> 400, unchanged | `-t "rejects a negative or missing hourmeterHours..."` | `:406-418` | PASS |
| C29 | unknown id -> 404 on hourmeter | `-t "hourmeter adjustment with an unknown id is 404"` | `:421-428` | PASS |
| C30 | sales -> 403 on hourmeter | `-t "sales gets 403 on the hourmeter adjustment"` | `:431-435` | PASS |
| C31 | no session -> 401 on hourmeter | `-t "hourmeter adjustment without a session is 401"` | `:438-442` | PASS |
| C32 | toPricingPrinterInput maps 3 fields exactly | `api test -t "maps printer fields to PrinterInput without conversion"` | `api/src/modules/printers/printers.types.spec.ts:26-30` - `expect(result).toEqual({powerWatts:250, costCents:500000, lifespanHours:10000})` | PASS |
| C33 | equivalence of depreciationCents/energyCents vs manual PrinterInput | `api test -t "produces the same pricing result..."` | `printers.types.spec.ts:33-50` - `expect(resultFromPrinter.costs.depreciationCents).toBe(resultTypedByHand...)`, same for `energyCents` | PASS |
| C34 | shows "Carregando…" before GET resolves | `web test -t "shows loading"` | `web/src/app/(app)/printers/page.test.tsx:59-69` - `expect(screen.getByText("Carregando…")).toBeTruthy()` | PASS |
| C35 | error + retry button refetches | `-t "shows the error and retries"` | `:74-87` - `screen.findByText("Não foi possível conectar à API")`, `callsTo(...).toHaveLength(2)` | PASS |
| C36 | empty state distinct from error | `-t "shows an empty state..."` | `:90-97` - `findByText("Nenhuma impressora encontrada.")`, `queryByText(error text)` null | PASS |
| C37 | sales sees read-only list only | `-t "sales sees only the read-only list"` | `:100-110` - 4x `queryByRole('button', ...)` null (Editar/Desativar/Ajustar horímetro/Salvar) | PASS |
| C38 | production sees only hourmeter control | `-t "production sees only the hourmeter control"` | `:113-123` | PASS |
| C39 | admin confirm dialog gates deactivate | `-t "confirms before deactivating"` | `:126-146` - cancel -> 0 calls; confirm -> 1 call with `{active:false}` | PASS |
| C40 | admin+production adjust hourmeter, no reload | `-t "admin and production adjust the hourmeter without reloading"` | `:149-166` - `bodyOf(...).toEqual({hourmeterHours:120.5})`, list fetched once | PASS |
| C41 | "Impressoras" menu item for all 3 roles | `web test -t "printers appears for every role"` | `web/src/components/app-shell.test.tsx:98-107` - `link.getAttribute("href")` `"/printers"` per role | PASS |

Proof commands run (batched, exact names shown above via `rg -n` against the spec files):
- `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts` -> 31/31 passed
- `npm --prefix api run test -- src/modules/printers/printers.types.spec.ts` -> 2/2 passed
- `npm --prefix web run test -- "src/app/(app)/printers/page.test.tsx" "src/components/app-shell.test.tsx"` -> 13/13 passed (5 page tests + confirm/hourmeter tests + 4 app-shell tests, incl. the pre-existing `materials appears for every role`)

Regression check at HEAD: `npm --prefix api run test` 96/96; `npm --prefix web run test` 86/86;
`npm --prefix api run lint` clean; `npm --prefix web run lint` clean. `npm --prefix api run
test:e2e` (full, 16 files): first run showed 3 unrelated failures in `test/users.e2e-spec.ts`
(`socket hang up` / timing) that do not reproduce running that file alone (25/25) or on a full
re-run at the same `HEAD` (179/179, 16 files). Isolating the base commit `5a299e8` in a scratch
worktree (`git worktree add`) and running the full e2e suite there also passes cleanly (148/148),
confirming this is pre-existing load/scrypt-timing flakiness in the suite's `beforeAll` hooks
(`api/vitest.config.e2e.ts` notes `hashPassword` costs ~0.3s per login), not a regression
introduced by this feature. 148 (base) + 31 (printers) = 179, matching the clean full run.

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `GET /printers` statuses (3) | `plan.md` Surface + `ListPrintersDto`/`AuthGuard` | 200 C12 · 400 C16 · 401 C17 | - |
| `POST /printers` statuses (4) | `plan.md` Surface + `CreatePrinterDto`/`RolesGuard` | 201 C1,C2,C3 · 400 C4,C5,C6,C7,C9 · 401 C11 · 403 C10 | - |
| `PATCH /printers/:id` statuses (5) | `plan.md` Surface + `UpdatePrinterDto`/service | 200 C18,C24,C25 · 400 C20,C21 · 401 C23 · 403 C22 · 404 C19 | - |
| `PATCH /printers/:id/hourmeter` statuses (5) | `plan.md` Surface + `AdjustHourmeterDto` | 200 C27 · 400 C28 · 401 C31 · 403 C30 · 404 C29 | - |
| roles x route reachability (12) | ROADMAP Matriz de permissões + `@Roles()` decorators in `printers.controller.ts` | admin: list C12, create C1, update C18, hourmeter C27 · production: list C12, create(403) C10, update(403) C22, hourmeter C27 · sales: list C12, create(403) C10, update(403) C22, hourmeter(403) C30 | - |
| validation boundaries revalidated POST vs PATCH (10 fields) | `create-printer.dto.ts`/`update-printer.dto.ts` decorators | acquisitionCostCents low, lifespanHours low/high, powerWatts low/high, nozzles count low/high, diameterMm out-of-range, type empty, amsSlots required -> POST C4,C6,C7 · PATCH C20 | - |
| `amsSlots` conditional to `hasAms` (2) | `printers.service.ts` create/update + DTOs | required when true C7 · null when false C8 | - |
| `active` lifecycle (3) | `printers.service.ts`/controller (no DELETE route) | deactivate C24 · reactivate C25 · no physical delete C26 | - |
| `toPricingPrinterInput` mapping + calc equivalence (5) | `printers.types.ts` door 4 + `PricingService.calculate` | powerWatts C32 · costCents(from acquisitionCostCents) C32 · lifespanHours C32 · depreciationCents equivalence C33 · energyCents equivalence C33 | - |
| web screen states (3) | `page.tsx` `Status` union | loading C34 · error+retry C35 · empty C36 | - |
| web role-gated UI (3) | `page.tsx` `editable`/`canAdjustHourmeter` | admin full controls C39,C40 · production hourmeter-only C38,C40 · sales read-only C37 | - |
| menu item across roles (1) | `app-shell.tsx` role condition | "Impressoras" for admin/production/sales C41 | - |

No unproven members. Every route x status combination in `plan.md` `Surface`, every role x route
cell in the ROADMAP permissions matrix, every validation boundary named in `## Criteria`, and every
`Landing` door has a located proof.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| `RolesGuard` applied on the 4 routes (decide, reached across the boundary) | `printers.controller.ts` | one e2e per route x role | yes - C1,C10,C11,C12,C17,C18,C22,C23,C24,C25,C26,C27,C30,C31; confirmed further by fault 1 (surviving would have meant a role leak) |
| `PATCH /printers/:id/hourmeter` liberates `production` write (novel form, no admin-only precedent) | `printers.controller.ts`/`printers.service.ts` | e2e per role on the dedicated route, isolated from the general PATCH | yes - admin+production write C27, sales blocked C30, general PATCH never accepts the key C21; fault 1 (role decorator swap) killed C27+C30 |
| cost/lifespan/power ranges (decide, same shape as `materials`/`pricing`) | `printers.service.ts` | e2e table-driven per field | yes - POST C4, PATCH revalidation C20; fault 4 (`powerWatts` `Max(5000)`->`Max(5001)`) killed C4 |
| `nozzles` nested-array bounds (decide, same shape as `CalculatePricingDto.materials`) | DTO/`printers.service.ts` | e2e table-driven, 4 cases | yes - POST C6, PATCH revalidation C20; fault 5 (`ArrayMaxSize(10)`->`(11)`) killed C6 |
| `amsSlots` conditional to `hasAms` (decide, same shape as `needsDrying`/`dryingTemperatureC`) | DTO/`printers.service.ts` | e2e for both cases, entry + revalidation | yes - required C7, ignored/null C8, revalidated on PATCH C20; fault 2 (combined `Min(1)`->`Min(0)` on the DTO **and** the service's `<1`->`<0`) killed C7 - see note below |

Note on fault 2: `amsSlots` on create is double-guarded - `CreatePrinterDto.amsSlots` carries
`@ValidateIf(hasAms===true) @IsInt() @Min(1)` (rejects `undefined` and `0` before the controller
runs) **and** `printers.service.ts:50` repeats `dto.amsSlots === undefined || dto.amsSlots < 1`.
Mutating either guard alone left the other one killing the same input, so a single-point mutation
on the DTO's `@Min(1)` survived, and a single-point mutation on the service's `< 1` also survived,
until the boundary was broken in both places at once. This is not a coverage gap - the observable
`400` for `amsSlots:0` is genuinely proven, just via two redundant paths rather than one -
consistent with a defense-in-depth reading, but it means a single mutation on either line alone
is not a meaningful "distinct assertion surface" test on its own.

## Faults injected

| Mutation | Location | Killed |
| --- | --- | --- |
| `@Roles('production')` -> `@Roles('sales')` on the hourmeter route | `api/src/modules/printers/printers.controller.ts:40` | yes - C27 (admin/production write) and C30 (sales blocked) both failed |
| `amsSlots >= 1` boundary relaxed to `>= 0` in both the DTO and the service check simultaneously | `api/src/modules/printers/dto/create-printer.dto.ts:79` + `api/src/modules/printers/printers.service.ts:50` | yes - C7 failed (`amsSlots:0` returned 201 instead of 400) |
| `toPricingPrinterInput` mapped `costCents` from `printer.lifespanHours` instead of `printer.acquisitionCostCents` | `api/src/modules/printers/printers.types.ts:45` | yes - both C32 and C33 failed |
| `powerWatts` upper bound `@Max(5000)` -> `@Max(5001)` | `api/src/modules/printers/dto/create-printer.dto.ts:55` | yes - C4 failed (5001 accepted with 201) |
| `nozzles` upper bound `@ArrayMaxSize(10)` -> `@ArrayMaxSize(11)` | `api/src/modules/printers/dto/create-printer.dto.ts:67` | yes - C6 failed (11-item list accepted with 201) |

Isolation: each fault applied in `git worktree add /tmp/claude-fault-printers HEAD` (never `git
stash`), narrowest covering proof run in the scratch worktree, confirmed FAIL, then reverted;
`git diff --stat` in the scratch tree showed clean before the next fault, and the real tree's
`git status --porcelain` matched the pre-session baseline (only the pre-existing, unrelated `M
ROADMAP.md` from before this verification started) after the worktree was discarded.

## Gate

`npm --prefix api run test:e2e -- test/printers.e2e-spec.ts` - 31 passed, 0 failed
`npm --prefix api run test -- src/modules/printers/printers.types.spec.ts` - 2 passed, 0 failed
`npm --prefix web run test -- "src/app/(app)/printers/page.test.tsx" "src/components/app-shell.test.tsx"` - 13 passed, 0 failed
`npm --prefix api run test` (full) - 96 passed, 0 failed
`npm --prefix api run test:e2e` (full, re-run) - 179 passed, 0 failed
`npm --prefix web run test` (full) - 86 passed, 0 failed
`npm --prefix api run lint` - clean
`npm --prefix web run lint` - clean
