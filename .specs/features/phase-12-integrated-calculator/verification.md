# Fase 12 — Calculadora integrada verification

**Verdict**: PASS
**Profile**: light
**Diff range**: `4649fff..HEAD`
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Commits in range: `c49d142` (feat(pricing): add POST /pricing/quote-preview), `acc1b32`
(feat(web): add the /pricing calculator screen), `cbbc3cf` (docs: mark phase 12 done in the
roadmap).

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | 200, `materialCents` from the material's avg cost (11 cents/g), matching a manual `PricingService.calculate` call | `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "calculates using the material's current average cost per gram"` exit 0 | `api/test/pricing-quote-preview.e2e-spec.ts:117` `expect(response.status).toBe(200);` and `:139` `expect((response.body as { costs: { materialCents: number } }).costs.materialCents).toBe(expected.costs.materialCents);` — `expected` built at `:120-134` from a literal `costPerGramCents: 11` | PASS |
| C2 | 200, `suppliesCents` from the stock item's avg cost | `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "calculates using the stock item's current average cost"` exit 0 | `api/test/pricing-quote-preview.e2e-spec.ts:150` `expect(response.status).toBe(200);` and `:167` `expect((response.body as { costs: { suppliesCents: number } }).costs.suppliesCents).toBe(expected.costs.suppliesCents);` — `expected` built at `:153-165` from a literal `unitCostCents: 500` | PASS |
| C3 | 200, `channels` shaped as `ChannelPrice` for 2 `channelIds` | `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "returns a channel price for each channelId requested"` exit 0 | `api/test/pricing-quote-preview.e2e-spec.ts:181` `expect(response.status).toBe(200);`, `:187` `expect(channels).toHaveLength(2);`, `:188-195` `expect(channel).toEqual(expect.objectContaining({ name: ..., unitPriceCents: ..., totalPriceCents: ..., minimumPriceApplied: ... }))` per element | PASS |
| C4 | 400 with material name in message when avg cost is null | `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "rejects a material with no average cost with its name in the message"` exit 0 | `api/test/pricing-quote-preview.e2e-spec.ts:214` `expect(response.status).toBe(400);` and `:215` `expect(errorOf(response)).toBe('Material sem custo médio disponível: PETG · Marca Sem Custo · Azul');` (literal) | PASS |
| C5 | 400 with stock item name in message when avg cost is null | `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "rejects a stock item with no average cost with its name in the message"` exit 0 | `api/test/pricing-quote-preview.e2e-spec.ts:224` `expect(response.status).toBe(400);` and `:225` `expect(errorOf(response)).toBe('Insumo sem custo médio disponível: Insumo Sem Custo QP');` (literal) | PASS |
| C6 | 404 with the id in the message, for printer/material/stockItem/channel (4 cases) | `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "returns 404 with the id in the message for an unknown printer, material, stock item or channel"` exit 0 | `:234` printer `expect(errorOf(printerCase)).toBe(\`Impressora ${unknownId} não encontrada\`)`; `:241` material `expect(errorOf(materialCase)).toBe(\`Material ${unknownId} não encontrado\`)`; `:248` stock item `expect(errorOf(stockItemCase)).toBe(\`Insumo ${unknownId} não encontrado\`)`; `:252` channel `expect(errorOf(channelCase)).toBe(\`Canal ${unknownId} não encontrado\`)` — all 4 cases individually asserted in one test | PASS |
| C7 | 400 with the literal `PricingError` message for a channel at/above 100% | `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "surfaces the same PricingError message as /pricing/calculate for a channel at or above 100%"` exit 0 | `api/test/pricing-quote-preview.e2e-spec.ts:273` `expect(response.status).toBe(400);` and `:274` `expect(errorOf(response)).toBe('Channel "qp-canal-alto": margin + taxes + fee must be below 100%');` (literal, matches `PricingError` text) | PASS |
| C8 | 200 echoes resolved `printer`, `materials[]`, `supplies[]`, `channels[]` names | `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "echoes the resolved names of every material, supply, printer and channel used"` exit 0 | `api/test/pricing-quote-preview.e2e-spec.ts:299` status 200; `:302` `expect(response.body.printer).toEqual({ id: fixtures.printerId, name: printerName });`; `:303-305` `expect(response.body.materials).toEqual([{ materialId: fixtures.materialId, name: 'PLA · Marca de teste · Natural', avgCostCentsPerGram: 11 }]);` (literal name matches `createMaterial`'s default `brand`/`color`, `api/test/materials-helper.ts:24-25`); `:306` supplies; `:308` `expect(channels[0]).toMatchObject({ id: fixtures.channelId, name: 'qp-canal-1' });` | PASS |
| C9 | `production` and `sales` get 200 like admin (2 cases) | `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "production and sales get 200 like admin"` exit 0 | `api/test/pricing-quote-preview.e2e-spec.ts:313-317` loop over `[productionCookie, salesCookie]`, `expect(response.status, cookie).toBe(200);` asserted per iteration (2 cases) | PASS |
| C10 | 401 without a session | `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "is 401 without a session"` exit 0 | `api/test/pricing-quote-preview.e2e-spec.ts:322` `expect(response.status).toBe(401);` and `:324` `expect(response.body).toEqual(SESSION_REQUIRED);` | PASS |
| C11 | empty `materials` and empty `channelIds` each 400 (2 cases) | `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "rejects an empty materials or channelIds list"` exit 0 | `api/test/pricing-quote-preview.e2e-spec.ts:330` `expect(emptyMaterials.status).toBe(400);` and `:333` `expect(emptyChannels.status).toBe(400);` | PASS |
| C12 | `QuotePreviewService.preview` builds a `PricingInput` from mocked fixtures and matches a direct `PricingService.calculate` call | `npm --prefix api run test -- src/modules/pricing/quote-preview.service.spec.ts -t "builds a PricingInput from the resolved fixtures and matches a direct PricingService.calculate call"` exit 0 | `api/src/modules/pricing/quote-preview.service.spec.ts:131` `expect(result.costs).toEqual(expected.costs);` — `expected` built at `:113-129` by calling `pricingService.calculate(...)` directly on a hand-built `PricingInput`, and `:132-136` assert `channels`/`printer`/`materials`/`supplies` against the mocked fixture values | PASS |
| C13 | shows "Carregando…" before the 4 registry GETs resolve | `npm --prefix web run test -- 'src/app/(app)/pricing/page.test.tsx' -t "shows loading"` exit 0 | `web/src/app/(app)/pricing/page.test.tsx:159` `expect(screen.getByText("Carregando…")).toBeTruthy();`, asserted before `resolveMaterials(...)` on `:160` | PASS |
| C14 | empty material selector shows a registration prompt, not an empty `<select>` | `npm --prefix web run test -- 'src/app/(app)/pricing/page.test.tsx' -t "shows an empty state on the material selector when none are registered"` exit 0 | `web/src/app/(app)/pricing/page.test.tsx:170-172` `expect(screen.getByText("Nenhum material cadastrado. Cadastre um material antes de calcular.")).toBeTruthy();` and `expect(screen.queryByRole("button", { name: "Adicionar material" })).toBeNull();` | PASS |
| C15 | pasting the MakerWorld fixture URL fills print time and adds a material selector per filament | `npm --prefix web run test -- 'src/app/(app)/pricing/page.test.tsx' -t "imports filaments from a MakerWorld URL and adds a material selector per filament"` exit 0 | `web/src/app/(app)/pricing/page.test.tsx:190-192` `expect((screen.getByLabelText("Horas de impressão") as HTMLInputElement).value).toBe(String(28 / 60));` and `:193-194` `expect(materialSelectors).toHaveLength(2);` from `screen.getAllByLabelText(/^Material \d+$/)` | PASS |
| C16 | manual material/supply lines use a registry selector, never a free-text cost field | `npm --prefix web run test -- 'src/app/(app)/pricing/page.test.tsx' -t "adds a material or supply line manually with a registry selector, never a free-text cost field"` exit 0 | `web/src/app/(app)/pricing/page.test.tsx:206-207` `expect(materialSelect.tagName).toBe("SELECT");` and `:213-214` `expect(supplySelect.tagName).toBe("SELECT");`; `:218` asserts no cost-field label matches (regex alternation over "custo material" / "custo insumo") resolves to `null` | PASS |
| C17 | selecting a registered printer sends its id, never a typed name | `npm --prefix web run test -- 'src/app/(app)/pricing/page.test.tsx' -t "sends the selected printer's id, never a typed name"` exit 0 | `web/src/app/(app)/pricing/page.test.tsx:240` `expect(bodyOf(call[1]).printerId).toBe("p1");` | PASS |
| C18 | Calcular sends the request, shows the breakdown, disables the button and shows a loading indicator while pending | `npm --prefix web run test -- 'src/app/(app)/pricing/page.test.tsx' -t "calculates and shows the breakdown, disabling the button while pending"` exit 0 | `web/src/app/(app)/pricing/page.test.tsx:259` `expect(screen.getByText("Calculando…")).toBeTruthy();` and `:260` `expect((screen.getByRole("button", { name: "Calcular" }) as HTMLButtonElement).disabled).toBe(true);` (pending state); `:264` `expect(screen.getByText("R$ 10.50")).toBeTruthy();` and `:266` `expect((... disabled).toBe(false);` after resolving | PASS |
| C19 | 400 shows `role="alert"` without clearing the form; recalculating after a quantity change re-fires the request without losing the rest of the form | `npm --prefix web run test -- 'src/app/(app)/pricing/page.test.tsx' -t "shows the error without clearing the form and allows recalculating after changing quantity"` exit 0 | `web/src/app/(app)/pricing/page.test.tsx:281-284` `expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Material sem custo médio disponível: PLA · Marca A · Natural");` plus `:285-286` form values preserved; `:293` `expect(callsTo(fetchMock, "/pricing/quote-preview")).toHaveLength(2);` and `:294` quantity preserved as `"2"` | PASS |

Batched runs: all 11 API e2e checks ran as a single `vitest` invocation with a `-t` alternation
(`11 passed (11)`, exit 0); the 7 web checks ran as a single invocation (`7 passed (7)`, exit 0);
C12 ran alone as the only test in its unit file (`1 passed (1)`, exit 0). Every named test was
individually located in the source tree before being cited (matches shown above), so no filter
matched zero tests.

Level check: C1-C11 each cross the HTTP boundary against the real `AppModule` via `supertest`
(`api/test/pricing-quote-preview.e2e-spec.ts`, no controller/service substituted) — the right
level for claims naming a status code, route or response shape. C12 asserts at the file's own
level (`QuotePreviewService` instantiated directly with the four dependent services replaced by
literal objects, `PricingService` real and unmocked) — correct, since the claim is about how
`QuotePreviewService` itself assembles the `PricingInput`, not about the route. C13-C19 assert
inside the rendered `PricingPage` component with `fetch` substituted — the correct level for a
screen-state claim (no assertion reaches into `PricingService`/API internals).

One thing noted while reading the tests, not rising to a check failure: in `page.test.tsx` the
`fetchMock` in `stubApi` throws on any unrouted path (`throw new Error(...)` at
`web/src/app/(app)/pricing/page.test.tsx:98`), so an unexpected or missing route call fails
loudly rather than silently resolving. This is a real mock, not one that could never fail. No
weak assertion or unconditionally-resolving mock was found in either test file.

## Swept

- validation (C11): re-read `api/src/modules/pricing/dto/create-quote-preview.dto.ts:44-45` —
  `@ArrayMinSize(1)` on `materials`, and `:65-66` `@ArrayMinSize(1)` on `channelIds`. Constraint
  exists as cited.
- failure modes (C4, C5, C6, C7): re-read `api/src/modules/pricing/quote-preview.service.ts` —
  `materialWithoutAverageCost`/`stockItemWithoutAverageCost` thrown at `:139` and `:158`
  respectively (`BadRequestException`), `printerNotFound`/`materialNotFound`/`stockItemNotFound`/
  `channelNotFound` thrown at `:113`, `:131`, `:155`, `:172` respectively (`NotFoundException`),
  and `PricingError` re-thrown as `BadRequestException` in `pricing.controller.ts:41-44`. All
  four failure modes exist as described.
- authorization (C9, C10, marked "existing"): re-read `api/src/modules/auth/auth.module.ts:22-23`
  — `{ provide: APP_GUARD, useClass: AuthGuard }` and `{ provide: APP_GUARD, useClass: RolesGuard }`
  registered globally, and `pricing.controller.ts:38` carries `@Roles('production', 'sales')` on
  `quotePreview` (admin passes unconditionally per `RolesGuard`, confirmed by reading
  `api/src/modules/auth/roles.guard.ts:9-13`). The guard is global as claimed; the new route does
  carry the decorator, so C9/C10 are exercising the real registration, not a bypassed one.
- idempotency/retry/duplicates, concurrency/ordering, data lifecycle, external-dependency failure,
  state transitions, observability (all `n/a`): re-read `quote-preview.service.ts` end to end —
  no write to any table (`inventory`, `printers`, `materials`, `settings` are all read through
  `getById`/`materialsSummary`/`get`/`getById`), confirming the `n/a` reasoning holds; no call to
  an external HTTP dependency exists in this file (MakerWorld access lives only in the untouched
  `print-profiles` module). These rows are policy, not a code claim, and nothing in the diff
  contradicts them.

## Gate

```
npm --prefix api run test -- src/modules/pricing/quote-preview.service.spec.ts
  Test Files  1 passed (1)  ·  Tests  1 passed (1)

npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "<11-name alternation>"
  Test Files  1 passed (1)  ·  Tests  11 passed (11)

npm --prefix web run test -- 'src/app/(app)/pricing/page.test.tsx' -t "<7-name alternation>"
  Test Files  1 passed (1)  ·  Tests  7 passed (7)
```

19/19 named checks proven, 19 passed, 0 failed.
